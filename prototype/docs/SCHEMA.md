# Schema — Workflow Engine v2

Last updated: 2026-04-16 (Step 4: seed templates + test harness)

## Current State

- **Migrations applied:** 3 (`00001_core_schema`, `00002_engine`, `00003_seed_templates`)
- **Templates seeded:** 2 (maintenance: 11 states, cleaning_turnover: 8 states)
- **Engine functions:** 8 (evaluate_condition, compute_next_action, fire_auto_actions, trigger_recompute, create_ticket, manual_override, validate_ticket_data, protect_workflow_states)
- **Tests:** 13 passing (6 scenarios + 7 guardrail checks)
- **Next step:** Step 5 (edge cases + hardening) — see docs/ROADMAP.md

## Tables (7)

### workflow_templates
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| slug | text | NOT NULL | — | UNIQUE |
| name | text | NOT NULL | — | |
| description | text | NULL | — | |
| category_group | text | NOT NULL | — | |
| data_schema | jsonb | NOT NULL | '{}' | Defines allowed fields in ticket.data |
| default_config | jsonb | NOT NULL | '{}' | Timings, SLA, priority weights |
| is_system | boolean | NOT NULL | true | |
| created_at | timestamptz | NOT NULL | now() | |

### workflow_states
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| template_id | uuid | NOT NULL | — | FK → workflow_templates(id) CASCADE |
| slug | text | NOT NULL | — | UNIQUE(template_id, slug) |
| name | text | NOT NULL | — | |
| bucket | text | NOT NULL | — | CHECK: needs_action, waiting, scheduled, completed, archived |
| position | int | NOT NULL | 0 | Display ordering |
| is_initial | boolean | NOT NULL | false | Exactly one per template (app-enforced) |
| is_terminal | boolean | NOT NULL | false | |
| timeout_hours | int | NULL | — | Hours before stuck |
| on_timeout | text | NULL | — | Target state slug on timeout |
| sla_hours | numeric | NULL | — | Per-state SLA (D017) |
| display_template | text | NOT NULL | — | Human-readable with {placeholders} |
| auto_actions | jsonb | NOT NULL | '[]' | Actions on state entry |
| transitions | jsonb | NOT NULL | '[]' | Conditions → target states |
| manual_overrides | jsonb | NOT NULL | '[]' | Human override options |
| created_at | timestamptz | NOT NULL | now() | |

**Trigger:** `trg_protect_workflow_states` — blocks delete/rename of active states, recomputes bucket on change.

### tickets
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| template_id | uuid | NOT NULL | — | FK → workflow_templates(id) |
| property_id | uuid | NULL | — | FK → properties(id) |
| parent_ticket_id | uuid | NULL | — | FK → tickets(id) self-ref |
| current_state | text | NOT NULL | — | Composite FK (template_id, current_state) → workflow_states |
| bucket | text | NOT NULL | — | CHECK: needs_action, waiting, scheduled, completed, archived |
| title | text | NOT NULL | — | |
| description | text | NULL | — | |
| assigned_to | uuid | NULL | — | FK → contacts(id) |
| data | jsonb | NOT NULL | '{}' | Validated against template data_schema |
| priority_score | int | NOT NULL | 0 | |
| waiting_since | timestamptz | NULL | — | Reset on every transition |
| sla_due_at | timestamptz | NULL | — | |
| created_at | timestamptz | NOT NULL | now() | |
| updated_at | timestamptz | NOT NULL | now() | |

**Trigger:** `trg_validate_ticket_data` — validates data JSONB against template schema on INSERT/UPDATE OF data.

### ticket_events
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| ticket_id | uuid | NOT NULL | — | FK → tickets(id) CASCADE |
| property_id | uuid | NULL | — | FK → properties(id), denormalised |
| transition_id | uuid | NULL | — | Groups events from same transition |
| event_type | text | NOT NULL | — | state_changed, action_fired, manual_override, etc. |
| from_state | text | NULL | — | |
| to_state | text | NULL | — | |
| trigger_type | text | NOT NULL | — | auto, manual, timer, webhook |
| actor_type | text | NOT NULL | 'system' | system, va, pm, contractor, etc. |
| actor_id | uuid | NULL | — | |
| actor_name | text | NULL | — | Denormalised point-in-time |
| action_type | text | NULL | — | For action_fired events |
| action_target | text | NULL | — | For action_fired events |
| metadata | jsonb | NOT NULL | '{}' | |
| created_at | timestamptz | NOT NULL | now() | |

### contacts
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| name | text | NOT NULL | — | |
| roles | text[] | NOT NULL | '{}' | cleaner, contractor, tenant, etc. |
| phone | text | NULL | — | |
| email | text | NULL | — | |
| preferred_channel | text | NOT NULL | 'whatsapp' | |
| property_ids | uuid[] | NULL | '{}' | D013: array for prototype |
| metadata | jsonb | NOT NULL | '{}' | Role-specific data |
| created_at | timestamptz | NOT NULL | now() | |

### properties
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| name | text | NOT NULL | — | |
| address | text | NULL | — | |
| property_type | text | NOT NULL | 'hmo' | |
| metadata | jsonb | NOT NULL | '{}' | |
| created_at | timestamptz | NOT NULL | now() | |

### action_queue
| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NOT NULL | gen_random_uuid() | PK |
| ticket_id | uuid | NOT NULL | — | FK → tickets(id) CASCADE |
| transition_id | uuid | NOT NULL | — | Groups with ticket_events |
| event_id | uuid | NOT NULL | — | FK → ticket_events(id) |
| action_type | text | NOT NULL | — | |
| channel | text | NOT NULL | — | |
| recipient_key | text | NOT NULL | — | 'role:X' or 'contact:UUID' (D020) |
| recipient_id | uuid | NULL | — | FK → contacts(id), resolved at send time |
| payload | jsonb | NOT NULL | '{}' | |
| status | text | NOT NULL | 'pending' | CHECK: pending, pending_confirmation, sent, failed, skipped |
| scheduled_for | timestamptz | NOT NULL | now() | |
| sent_at | timestamptz | NULL | — | |
| created_at | timestamptz | NOT NULL | now() | |

**Constraint:** UNIQUE(transition_id, action_type, recipient_key) — idempotency (D020)

## Functions (8)

### evaluate_condition(condition jsonb, data jsonb, waiting_since timestamptz) → boolean
Pure function. Evaluates one condition against ticket data. Supports 11 frozen operators. STABLE.

### compute_next_action(ticket_id uuid) → TABLE(new_state, new_bucket, transitioned)
THE engine. Template-agnostic. Checks timeout first, then evaluates transitions. No side effects. STABLE.

### fire_auto_actions(ticket_id, transition_id, target_state, trigger_type) → void
Queues auto-actions to action_queue. Logs action_fired events. Idempotent via UNIQUE constraint.

### trigger_recompute() → trigger
AFTER UPDATE OF data on tickets. Calls compute_next_action, writes 4-field atomic update, logs events, fires actions. Self-recursion guarded.

### create_ticket(template_slug, title, description, data, property_id, assigned_to, parent_ticket_id) → uuid
Creates ticket in initial state. Logs ticket_created event. Fires initial state auto-actions.

### manual_override(ticket_id, target_state, actor_id, actor_name, reason) → void
Human moves ticket. Validates against manual_overrides. Logs manual_override event. Fires auto-actions with trigger_type='manual'.

### validate_ticket_data() → trigger
BEFORE INSERT/UPDATE OF data on tickets. Validates against template data_schema. Full type checking (D021).

### protect_workflow_states() → trigger
BEFORE UPDATE/DELETE on workflow_states. Blocks dangerous mutations (D012).

## Triggers (3)

| Trigger | Table | Timing | Event | Function |
|---------|-------|--------|-------|----------|
| trg_validate_ticket_data | tickets | BEFORE | INSERT, UPDATE OF data | validate_ticket_data() |
| trg_protect_workflow_states | workflow_states | BEFORE | UPDATE, DELETE | protect_workflow_states() |
| trg_recompute_on_data_change | tickets | AFTER | UPDATE OF data | trigger_recompute() |
