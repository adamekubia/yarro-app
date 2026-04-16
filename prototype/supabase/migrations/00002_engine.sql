-- ============================================================
-- Workflow Engine v2 — Universal Engine
-- 5 functions + 1 trigger + 1 RPC (manual_override) + 1 RPC (create_ticket)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Function 1: evaluate_condition
-- Pure function. Evaluates one condition against ticket data.
-- Returns boolean. No side effects.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION evaluate_condition(
  p_condition jsonb,
  p_data jsonb,
  p_waiting_since timestamptz
) RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_field text;
  v_op text;
  v_value jsonb;
  v_actual jsonb;
  v_conditions jsonb;
  v_cond jsonb;
BEGIN
  -- Compound: all_of (AND)
  IF p_condition ? 'all_of' THEN
    v_conditions := p_condition->'all_of';
    FOR v_cond IN SELECT * FROM jsonb_array_elements(v_conditions)
    LOOP
      IF NOT evaluate_condition(v_cond, p_data, p_waiting_since) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- Compound: any_of (OR)
  IF p_condition ? 'any_of' THEN
    v_conditions := p_condition->'any_of';
    FOR v_cond IN SELECT * FROM jsonb_array_elements(v_conditions)
    LOOP
      IF evaluate_condition(v_cond, p_data, p_waiting_since) THEN
        RETURN true;
      END IF;
    END LOOP;
    RETURN false;
  END IF;

  -- Simple condition
  v_field := p_condition->>'field';
  v_op := p_condition->>'op';

  -- Special: after_hours reads waiting_since, not data
  IF v_op = 'after_hours' THEN
    IF p_waiting_since IS NULL THEN RETURN false; END IF;
    RETURN EXTRACT(EPOCH FROM (now() - p_waiting_since)) / 3600
           > (p_condition->'value')::numeric;
  END IF;

  -- Read actual value from ticket data
  v_actual := p_data->v_field;
  v_value := p_condition->'value';

  -- Null checks
  IF v_op = 'is_null' THEN
    RETURN v_actual IS NULL OR v_actual = 'null'::jsonb;
  END IF;
  IF v_op = 'is_not_null' THEN
    RETURN v_actual IS NOT NULL AND v_actual != 'null'::jsonb;
  END IF;

  -- Value comparisons (both must be non-null)
  IF v_actual IS NULL OR v_actual = 'null'::jsonb OR v_value IS NULL THEN
    RETURN false;
  END IF;

  CASE v_op
    -- Equality works on any JSONB type
    WHEN 'eq'  THEN RETURN v_actual = v_value;
    WHEN 'neq' THEN RETURN v_actual != v_value;
    -- Numeric only (D018). Dates stored as epoch seconds.
    WHEN 'gt'  THEN RETURN (v_actual#>>'{}')::numeric > (v_value#>>'{}')::numeric;
    WHEN 'lt'  THEN RETURN (v_actual#>>'{}')::numeric < (v_value#>>'{}')::numeric;
    WHEN 'gte' THEN RETURN (v_actual#>>'{}')::numeric >= (v_value#>>'{}')::numeric;
    WHEN 'lte' THEN RETURN (v_actual#>>'{}')::numeric <= (v_value#>>'{}')::numeric;
    ELSE
      -- Guardrail G2: frozen operator list. Unknown = hard error.
      RAISE EXCEPTION 'Unknown operator: "%"', v_op;
  END CASE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 2: compute_next_action
-- THE engine function. Template-agnostic. No side effects.
-- Reads state machine data, evaluates conditions, returns result.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_next_action(p_ticket_id uuid)
RETURNS TABLE(new_state text, new_bucket text, transitioned boolean)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_ticket tickets%rowtype;
  v_current_state workflow_states%rowtype;
  v_transition jsonb;
  v_target_state workflow_states%rowtype;
BEGIN
  -- Load ticket
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'compute_next_action: ticket % not found', p_ticket_id;
  END IF;

  -- Load current state definition
  SELECT * INTO v_current_state
  FROM workflow_states
  WHERE template_id = v_ticket.template_id
    AND slug = v_ticket.current_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'compute_next_action: state "%" not found for template %',
      v_ticket.current_state, v_ticket.template_id;
  END IF;

  -- Terminal state: no transitions, ticket is done
  IF v_current_state.is_terminal THEN
    RETURN QUERY SELECT v_ticket.current_state, v_ticket.bucket, false;
    RETURN;
  END IF;

  -- Check timeout FIRST (D019: timeout before transitions)
  -- Late data handled by template design: timeout destination states
  -- include transitions for late arrivals.
  IF v_current_state.timeout_hours IS NOT NULL
     AND v_ticket.waiting_since IS NOT NULL
     AND EXTRACT(EPOCH FROM (now() - v_ticket.waiting_since)) / 3600
         > v_current_state.timeout_hours
  THEN
    IF v_current_state.on_timeout IS NOT NULL THEN
      SELECT * INTO v_target_state
      FROM workflow_states
      WHERE template_id = v_ticket.template_id
        AND slug = v_current_state.on_timeout;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'compute_next_action: on_timeout target "%" not found for template %',
          v_current_state.on_timeout, v_ticket.template_id;
      END IF;

      RETURN QUERY SELECT v_target_state.slug, v_target_state.bucket, true;
      RETURN;
    ELSE
      -- No on_timeout defined: surface as needs_action
      RETURN QUERY SELECT v_ticket.current_state, 'needs_action'::text, true;
      RETURN;
    END IF;
  END IF;

  -- Evaluate transitions in order — first match wins
  FOR v_transition IN SELECT * FROM jsonb_array_elements(v_current_state.transitions)
  LOOP
    IF evaluate_condition(
      v_transition->'when',
      v_ticket.data,
      v_ticket.waiting_since
    ) THEN
      -- Transition matched: load target state
      SELECT * INTO v_target_state
      FROM workflow_states
      WHERE template_id = v_ticket.template_id
        AND slug = v_transition->>'to';

      IF NOT FOUND THEN
        RAISE EXCEPTION 'compute_next_action: transition target "%" not found in template %',
          v_transition->>'to', v_ticket.template_id;
      END IF;

      RETURN QUERY SELECT v_target_state.slug, v_target_state.bucket, true;
      RETURN;
    END IF;
  END LOOP;

  -- No transition matched: stay in current state
  RETURN QUERY SELECT v_ticket.current_state, v_ticket.bucket, false;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 3: fire_auto_actions
-- Queues auto-actions to action_queue. Logs events.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fire_auto_actions(
  p_ticket_id uuid,
  p_transition_id uuid,
  p_target_state workflow_states,
  p_trigger_type text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_action jsonb;
  v_ticket tickets%rowtype;
  v_event_id uuid;
  v_status text;
  v_recipient_key text;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;

  FOR v_action IN SELECT * FROM jsonb_array_elements(p_target_state.auto_actions)
  LOOP
    -- Compute recipient_key (D020: non-nullable for UNIQUE constraint)
    v_recipient_key := CASE
      WHEN v_action->>'to_contact_id' IS NOT NULL
        THEN 'contact:' || (v_action->>'to_contact_id')
      ELSE 'role:' || COALESCE(v_action->>'to_role', 'system')
    END;

    -- Log the action_fired event
    INSERT INTO ticket_events (
      ticket_id, property_id, transition_id,
      event_type, from_state, to_state,
      trigger_type, actor_type,
      action_type, action_target,
      metadata
    ) VALUES (
      p_ticket_id, v_ticket.property_id, p_transition_id,
      'action_fired', NULL, p_target_state.slug,
      p_trigger_type, 'system',
      v_action->>'type', v_recipient_key,
      v_action
    ) RETURNING id INTO v_event_id;

    -- Determine queue status (D016: create_ticket needs confirmation on manual override)
    v_status := 'pending';
    IF v_action->>'type' = 'create_ticket' AND p_trigger_type = 'manual' THEN
      v_status := 'pending_confirmation';
    END IF;

    -- Queue the action (UNIQUE constraint prevents duplicates per transition)
    INSERT INTO action_queue (
      ticket_id, transition_id, event_id,
      action_type, channel,
      recipient_key, recipient_id,
      payload, status,
      scheduled_for
    ) VALUES (
      p_ticket_id, p_transition_id, v_event_id,
      v_action->>'type',
      COALESCE(v_action->>'channel', 'preferred'),
      v_recipient_key,
      NULL,  -- resolved by comms layer at send time
      v_action,
      v_status,
      now() + (COALESCE((v_action->>'delay_hours')::numeric, 0) * interval '1 hour')
    )
    ON CONFLICT (transition_id, action_type, recipient_key) DO NOTHING;

  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 4: trigger_recompute
-- Trigger entry point. Fires on ticket.data changes.
-- Calls engine, writes result atomically, logs events, fires actions.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_recompute()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_result RECORD;
  v_old_state text;
  v_old_bucket text;
  v_transition_id uuid;
  v_target_state_row workflow_states%rowtype;
  v_transition_label text;
BEGIN
  -- Self-recursion guard (proven pattern from production)
  IF current_setting('engine.recomputing', true) = 'true' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('engine.recomputing', 'true', true);

  -- Read old state before computation
  v_old_state := OLD.current_state;
  v_old_bucket := OLD.bucket;

  -- COMPUTE
  SELECT * INTO v_result FROM compute_next_action(NEW.id);

  -- Only act if state actually changed
  IF v_result.transitioned AND v_result.new_state IS DISTINCT FROM v_old_state THEN
    v_transition_id := gen_random_uuid();

    -- Load target state for auto-actions and SLA
    SELECT * INTO v_target_state_row
    FROM workflow_states
    WHERE template_id = NEW.template_id AND slug = v_result.new_state;

    -- Find transition label for audit trail
    SELECT t->>'label' INTO v_transition_label
    FROM workflow_states ws,
         jsonb_array_elements(ws.transitions) t
    WHERE ws.template_id = NEW.template_id
      AND ws.slug = v_old_state
      AND t->>'to' = v_result.new_state
    LIMIT 1;

    -- 4-FIELD ATOMIC WRITE
    UPDATE tickets
    SET current_state = v_result.new_state,
        bucket = v_result.new_bucket,
        waiting_since = now(),
        sla_due_at = CASE
          WHEN v_target_state_row.sla_hours IS NOT NULL
            THEN now() + (v_target_state_row.sla_hours * interval '1 hour')
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = NEW.id;

    -- LOG STATE CHANGE EVENT
    INSERT INTO ticket_events (
      ticket_id, property_id, transition_id,
      event_type, from_state, to_state,
      trigger_type, actor_type,
      metadata
    ) VALUES (
      NEW.id, NEW.property_id, v_transition_id,
      'state_changed', v_old_state, v_result.new_state,
      'auto', 'system',
      jsonb_build_object(
        'from_bucket', v_old_bucket,
        'to_bucket', v_result.new_bucket,
        'transition_label', v_transition_label
      )
    );

    -- FIRE AUTO-ACTIONS
    PERFORM fire_auto_actions(NEW.id, v_transition_id, v_target_state_row, 'auto');
  END IF;

  PERFORM set_config('engine.recomputing', 'false', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recompute_on_data_change
  AFTER UPDATE OF data ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recompute();

-- ────────────────────────────────────────────────────────────
-- Function 5: create_ticket (RPC)
-- Creates a ticket, logs creation event, fires initial auto-actions.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_ticket(
  p_template_slug text,
  p_title text DEFAULT 'New ticket',
  p_description text DEFAULT NULL,
  p_data jsonb DEFAULT '{}',
  p_property_id uuid DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL,
  p_parent_ticket_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_template workflow_templates%rowtype;
  v_initial_state workflow_states%rowtype;
  v_ticket_id uuid;
  v_transition_id uuid;
BEGIN
  -- Load template
  SELECT * INTO v_template
  FROM workflow_templates WHERE slug = p_template_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template "%" not found', p_template_slug;
  END IF;

  -- Load initial state
  SELECT * INTO v_initial_state
  FROM workflow_states
  WHERE template_id = v_template.id AND is_initial = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template "%" has no initial state', p_template_slug;
  END IF;

  v_transition_id := gen_random_uuid();

  -- CREATE TICKET (validate_ticket_data trigger fires here)
  INSERT INTO tickets (
    template_id, property_id, parent_ticket_id,
    current_state, bucket,
    title, description, assigned_to,
    data, waiting_since,
    sla_due_at
  ) VALUES (
    v_template.id, p_property_id, p_parent_ticket_id,
    v_initial_state.slug, v_initial_state.bucket,
    p_title, p_description, p_assigned_to,
    p_data, now(),
    CASE
      WHEN v_initial_state.sla_hours IS NOT NULL
        THEN now() + (v_initial_state.sla_hours * interval '1 hour')
      ELSE NULL
    END
  ) RETURNING id INTO v_ticket_id;

  -- LOG CREATION EVENT
  INSERT INTO ticket_events (
    ticket_id, property_id, transition_id,
    event_type, to_state,
    trigger_type, actor_type,
    metadata
  ) VALUES (
    v_ticket_id, p_property_id, v_transition_id,
    'ticket_created', v_initial_state.slug,
    'auto', 'system',
    jsonb_build_object('template', p_template_slug, 'initial_data', p_data)
  );

  -- FIRE INITIAL STATE AUTO-ACTIONS
  PERFORM fire_auto_actions(v_ticket_id, v_transition_id, v_initial_state, 'auto');

  RETURN v_ticket_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Function 6: manual_override (RPC)
-- Human moves ticket to a different state.
-- Validates against allowed overrides. Fires auto-actions.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION manual_override(
  p_ticket_id uuid,
  p_target_state text,
  p_actor_id uuid DEFAULT NULL,
  p_actor_name text DEFAULT 'VA',
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket tickets%rowtype;
  v_target_state_row workflow_states%rowtype;
  v_current_state_row workflow_states%rowtype;
  v_old_state text;
  v_old_bucket text;
  v_transition_id uuid;
  v_override jsonb;
  v_valid boolean := false;
BEGIN
  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  v_old_state := v_ticket.current_state;
  v_old_bucket := v_ticket.bucket;

  -- Load current state to check manual_overrides
  SELECT * INTO v_current_state_row
  FROM workflow_states
  WHERE template_id = v_ticket.template_id
    AND slug = v_ticket.current_state;

  -- Validate: target must be in manual_overrides for current state
  FOR v_override IN SELECT * FROM jsonb_array_elements(v_current_state_row.manual_overrides)
  LOOP
    IF v_override->>'to' = p_target_state THEN
      v_valid := true;

      -- Check if reason is required
      IF (v_override->>'requires_reason')::boolean = true AND p_reason IS NULL THEN
        RAISE EXCEPTION 'Manual override to "%" requires a reason', p_target_state;
      END IF;

      EXIT;
    END IF;
  END LOOP;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Manual override to "%" not allowed from state "%"',
      p_target_state, v_ticket.current_state;
  END IF;

  -- Load target state
  SELECT * INTO v_target_state_row
  FROM workflow_states
  WHERE template_id = v_ticket.template_id AND slug = p_target_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target state "%" not found in template', p_target_state;
  END IF;

  v_transition_id := gen_random_uuid();

  -- Disable recompute trigger during manual override
  -- (we're changing current_state, not data, but the 4-field UPDATE
  -- could theoretically interact with other triggers)
  PERFORM set_config('engine.recomputing', 'true', true);

  -- ATOMIC WRITE
  UPDATE tickets
  SET current_state = v_target_state_row.slug,
      bucket = v_target_state_row.bucket,
      waiting_since = now(),
      sla_due_at = CASE
        WHEN v_target_state_row.sla_hours IS NOT NULL
          THEN now() + (v_target_state_row.sla_hours * interval '1 hour')
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- LOG MANUAL OVERRIDE EVENT
  INSERT INTO ticket_events (
    ticket_id, property_id, transition_id,
    event_type, from_state, to_state,
    trigger_type, actor_type, actor_id, actor_name,
    metadata
  ) VALUES (
    p_ticket_id, v_ticket.property_id, v_transition_id,
    'manual_override', v_old_state, p_target_state,
    'manual', 'va', p_actor_id, p_actor_name,
    jsonb_build_object('reason', p_reason)
  );

  -- FIRE AUTO-ACTIONS (with manual trigger type — create_ticket gets pending_confirmation)
  PERFORM fire_auto_actions(p_ticket_id, v_transition_id, v_target_state_row, 'manual');

  PERFORM set_config('engine.recomputing', 'false', true);
END;
$$;
