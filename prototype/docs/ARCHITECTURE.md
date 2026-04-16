# Architecture — Workflow Engine v2

## Four Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 1: Workflow Templates                     │
│  What workflows exist. Config + data schema.     │
│  Table: workflow_templates                       │
├─────────────────────────────────────────────────┤
│  Layer 2: Workflow States                        │
│  State machines as JSONB data per template.      │
│  Table: workflow_states                          │
├─────────────────────────────────────────────────┤
│  Layer 3: Tickets                                │
│  Work items flowing through state machines.      │
│  Tables: tickets, ticket_events, action_queue    │
├─────────────────────────────────────────────────┤
│  Layer 4: Engine                                 │
│  One function. Reads data, evaluates, transitions│
│  Functions: compute_next_action, trigger, etc.   │
└─────────────────────────────────────────────────┘
```

## Table Relationships

```
workflow_templates
  │
  ├─ 1:N → workflow_states (template_id FK)
  │
  └─ 1:N → tickets (template_id FK)
              │
              ├─ composite FK → workflow_states (template_id, current_state)
              ├─ self-ref FK → tickets (parent_ticket_id)
              ├─ FK → contacts (assigned_to)
              ├─ FK → properties (property_id)
              │
              ├─ 1:N → ticket_events (ticket_id FK)
              │          └─ FK → properties (property_id, denormalised)
              │
              └─ 1:N → action_queue (ticket_id FK)
                         └─ FK → ticket_events (event_id)
```

## Data Flow

### Automatic Transition (engine-driven)
```
External event (contractor responds, webhook fires)
  ↓
  UPDATE tickets SET data = data || '{"contractor_responded": true}'
  ↓
  trg_recompute_on_data_change fires (AFTER UPDATE OF data)
  ↓
  trigger_recompute():
    1. Self-recursion guard (session variable)
    2. compute_next_action(ticket_id)
       → Load ticket + current state definition
       → Check timeout (fires first if expired)
       → Evaluate transitions in order (first match wins)
       → Return (new_state, new_bucket, transitioned)
    3. If transitioned:
       a. Generate transition_id (UUID)
       b. UPDATE tickets — 4-field write (state, bucket, waiting_since, sla_due_at)
       c. INSERT ticket_events — state_changed
       d. fire_auto_actions()
          → INSERT ticket_events per action (action_fired)
          → INSERT action_queue per action (with idempotency)
    4. Clear recursion guard
  ↓
  Transaction commits (all or nothing)
```

### Manual Override (human-driven)
```
VA clicks "move to X" in UI
  ↓
  RPC: manual_override(ticket_id, target_state, actor_id, reason)
  ↓
  1. Validate target is in manual_overrides for current state
  2. Generate transition_id
  3. UPDATE tickets (state + bucket + waiting_since, SLA cleared)
  4. INSERT ticket_events (manual_override)
  5. fire_auto_actions(trigger_type='manual')
     → create_ticket actions get 'pending_confirmation' status
  ↓
  Transaction commits
```

### Ticket Creation
```
RPC: create_ticket('maintenance', property_id, title, data)
  ↓
  1. Load template + initial state
  2. INSERT tickets (validate_ticket_data trigger fires on data)
  3. INSERT ticket_events (ticket_created)
  4. fire_auto_actions for initial state
  ↓
  Transaction commits
```

## Layer Boundaries

### Engine owns:
- State computation (evaluate conditions, determine next state)
- Transition execution (atomic 4-field write)
- Event logging (ticket_events)
- Action queuing (action_queue)
- Data validation (ticket.data against template schema) — see G1
- Timeout detection — see G9
- Guardrails: G1 (data schema), G3 (template-agnostic), G9 (stuck detection), G10 (idempotency)

### Comms layer owns (not built yet):
- Message delivery (WhatsApp, SMS, email)
- Recipient resolution (role → contact)
- Channel selection (preferred_channel)
- Notification throttling (batch by recipient + time window) — see G12
- AI message composition

### UI layer owns (not built yet):
- Display template rendering (fill placeholders) — see G13
- Bucket grouping (dashboard columns)
- Priority sorting
- Manual override UI (show available overrides per state) — see G11
- Action confirmation UI (pending_confirmation queue)

## Engine Contract

`compute_next_action(ticket_id)` guarantees:
- **Deterministic:** same ticket data → same result, always
- **Template-agnostic:** zero IF statements referencing template slugs — see G3
- **No side effects:** only reads and computes, never writes
- **Fail-loud:** missing ticket/state/target = RAISE EXCEPTION, not silent failure
- **Timeout-first:** timeout checked before transitions (late data handled by template design) — see G9, D019

Condition evaluation contract defined in docs/CONVENTIONS.md (operators, JSONB formats, nesting limits).
