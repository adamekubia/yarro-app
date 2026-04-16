-- ============================================================
-- Workflow Engine v2 — Core Schema
-- 7 tables + validation trigger + safe mutation trigger
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Table 1: workflow_templates
-- Registry of available workflow types.
-- ────────────────────────────────────────────────────────────

CREATE TABLE workflow_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  description     text,
  category_group  text NOT NULL,
  data_schema     jsonb NOT NULL DEFAULT '{}',
  default_config  jsonb NOT NULL DEFAULT '{}',
  is_system       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Table 2: workflow_states
-- State machine definitions. One row per state per template.
-- Transitions, auto-actions, and overrides are JSONB.
-- ────────────────────────────────────────────────────────────

CREATE TABLE workflow_states (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  slug             text NOT NULL,
  name             text NOT NULL,
  bucket           text NOT NULL CHECK (bucket IN ('needs_action', 'waiting', 'scheduled', 'completed', 'archived')),
  position         int NOT NULL DEFAULT 0,
  is_initial       boolean NOT NULL DEFAULT false,
  is_terminal      boolean NOT NULL DEFAULT false,
  timeout_hours    int,
  on_timeout       text,
  sla_hours        numeric,
  display_template text NOT NULL,
  auto_actions     jsonb NOT NULL DEFAULT '[]',
  transitions      jsonb NOT NULL DEFAULT '[]',
  manual_overrides jsonb NOT NULL DEFAULT '[]',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, slug)
);

-- ────────────────────────────────────────────────────────────
-- Table 6: properties (supporting — created before tickets FK)
-- ────────────────────────────────────────────────────────────

CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  address         text,
  property_type   text NOT NULL DEFAULT 'hmo',
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Table 5: contacts (supporting — created before tickets FK)
-- Unified people table: cleaners, contractors, tenants, etc.
-- ────────────────────────────────────────────────────────────

CREATE TABLE contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  roles               text[] NOT NULL DEFAULT '{}',
  phone               text,
  email               text,
  preferred_channel   text NOT NULL DEFAULT 'whatsapp',
  property_ids        uuid[] DEFAULT '{}',
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Table 3: tickets
-- Work items flowing through state machines.
-- All workflow-specific data in `data` JSONB.
-- ────────────────────────────────────────────────────────────

CREATE TABLE tickets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid NOT NULL REFERENCES workflow_templates(id),
  property_id      uuid REFERENCES properties(id),
  parent_ticket_id uuid REFERENCES tickets(id),
  current_state    text NOT NULL,
  bucket           text NOT NULL CHECK (bucket IN ('needs_action', 'waiting', 'scheduled', 'completed', 'archived')),
  title            text NOT NULL,
  description      text,
  assigned_to      uuid REFERENCES contacts(id),
  data             jsonb NOT NULL DEFAULT '{}',
  priority_score   int NOT NULL DEFAULT 0,
  waiting_since    timestamptz,
  sla_due_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_id, current_state) REFERENCES workflow_states(template_id, slug)
);

-- ────────────────────────────────────────────────────────────
-- Table 4: ticket_events
-- Complete audit trail. Every state transition, action, override.
-- ────────────────────────────────────────────────────────────

CREATE TABLE ticket_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  property_id     uuid REFERENCES properties(id),
  transition_id   uuid,
  event_type      text NOT NULL,
  from_state      text,
  to_state        text,
  trigger_type    text NOT NULL,
  actor_type      text NOT NULL DEFAULT 'system',
  actor_id        uuid,
  actor_name      text,
  action_type     text,
  action_target   text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- Table 7: action_queue
-- Dispatch queue for auto-actions. Engine writes, comms reads.
-- ────────────────────────────────────────────────────────────

CREATE TABLE action_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  transition_id   uuid NOT NULL,
  event_id        uuid NOT NULL REFERENCES ticket_events(id),
  action_type     text NOT NULL,
  channel         text NOT NULL,
  recipient_key   text NOT NULL,
  recipient_id    uuid REFERENCES contacts(id),
  payload         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_confirmation', 'sent', 'failed', 'skipped')),
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transition_id, action_type, recipient_key)
);

-- ============================================================
-- TRIGGER: validate_ticket_data
-- Validates ticket.data against template's data_schema.
-- Fires BEFORE INSERT/UPDATE OF data on tickets.
-- ============================================================

CREATE OR REPLACE FUNCTION validate_ticket_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_fields jsonb;
  v_key text;
  v_field_def jsonb;
  v_expected_type text;
  v_actual jsonb;
BEGIN
  -- Load schema from template
  SELECT data_schema->'fields' INTO v_fields
  FROM workflow_templates
  WHERE id = NEW.template_id;

  -- No schema defined = no validation (permissive)
  IF v_fields IS NULL OR v_fields = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Check for unknown fields
  FOR v_key IN SELECT jsonb_object_keys(NEW.data)
  LOOP
    IF NOT v_fields ? v_key THEN
      RAISE EXCEPTION 'Unknown field "%" in ticket data for template %',
        v_key, NEW.template_id;
    END IF;
  END LOOP;

  -- Check required fields + type validation
  FOR v_key, v_field_def IN SELECT * FROM jsonb_each(v_fields)
  LOOP
    -- Required check
    IF (v_field_def->>'required')::boolean = true THEN
      IF NOT (NEW.data ? v_key) OR NEW.data->v_key = 'null'::jsonb THEN
        RAISE EXCEPTION 'Required field "%" missing in ticket data for template %',
          v_key, NEW.template_id;
      END IF;
    END IF;

    -- Type check (only if field is present and not null)
    IF (NEW.data ? v_key) AND NEW.data->v_key != 'null'::jsonb THEN
      v_expected_type := v_field_def->>'type';
      v_actual := NEW.data->v_key;

      CASE v_expected_type
        WHEN 'boolean' THEN
          IF jsonb_typeof(v_actual) != 'boolean' THEN
            RAISE EXCEPTION 'Field "%" must be boolean, got % in template %',
              v_key, jsonb_typeof(v_actual), NEW.template_id;
          END IF;
        WHEN 'number' THEN
          IF jsonb_typeof(v_actual) != 'number' THEN
            RAISE EXCEPTION 'Field "%" must be number, got % in template %',
              v_key, jsonb_typeof(v_actual), NEW.template_id;
          END IF;
        WHEN 'text' THEN
          IF jsonb_typeof(v_actual) != 'string' THEN
            RAISE EXCEPTION 'Field "%" must be text, got % in template %',
              v_key, jsonb_typeof(v_actual), NEW.template_id;
          END IF;
        WHEN 'uuid' THEN
          IF jsonb_typeof(v_actual) != 'string' THEN
            RAISE EXCEPTION 'Field "%" must be uuid (string), got % in template %',
              v_key, jsonb_typeof(v_actual), NEW.template_id;
          END IF;
          BEGIN
            PERFORM (v_actual#>>'{}')::uuid;
          EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'Field "%" has invalid UUID format in template %',
              v_key, NEW.template_id;
          END;
        WHEN 'timestamptz' THEN
          IF jsonb_typeof(v_actual) != 'string' THEN
            RAISE EXCEPTION 'Field "%" must be timestamptz (string), got % in template %',
              v_key, jsonb_typeof(v_actual), NEW.template_id;
          END IF;
        ELSE
          RAISE EXCEPTION 'Unknown type "%" for field "%" in template % data_schema',
            v_expected_type, v_key, NEW.template_id;
      END CASE;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_ticket_data
  BEFORE INSERT OR UPDATE OF data ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_ticket_data();

-- ============================================================
-- TRIGGER: protect_workflow_states
-- Blocks dangerous mutations on states referenced by tickets.
-- ============================================================

CREATE OR REPLACE FUNCTION protect_workflow_states()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_count int;
BEGIN
  -- Block DELETE if any open ticket is in this state
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO v_active_count
    FROM tickets
    WHERE template_id = OLD.template_id
      AND current_state = OLD.slug
      AND bucket NOT IN ('completed', 'archived');

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete state "%" — % open ticket(s) are in this state',
        OLD.slug, v_active_count;
    END IF;
    RETURN OLD;
  END IF;

  -- Block slug rename if any open ticket references it
  IF TG_OP = 'UPDATE' AND OLD.slug != NEW.slug THEN
    SELECT count(*) INTO v_active_count
    FROM tickets
    WHERE template_id = OLD.template_id
      AND current_state = OLD.slug
      AND bucket NOT IN ('completed', 'archived');

    IF v_active_count > 0 THEN
      RAISE EXCEPTION 'Cannot rename state "%" — % open ticket(s) reference it',
        OLD.slug, v_active_count;
    END IF;
  END IF;

  -- Bucket change: recompute on all open tickets in this state
  IF TG_OP = 'UPDATE' AND OLD.bucket != NEW.bucket THEN
    UPDATE tickets
    SET bucket = NEW.bucket, updated_at = now()
    WHERE template_id = NEW.template_id
      AND current_state = NEW.slug
      AND bucket NOT IN ('completed', 'archived');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_workflow_states
  BEFORE UPDATE OR DELETE ON workflow_states
  FOR EACH ROW
  EXECUTE FUNCTION protect_workflow_states();
