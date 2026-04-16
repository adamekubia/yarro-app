# Guardrails — Workflow Engine v2

19 guardrails. Each has a concrete enforcement mechanism. Read at session start.

---

## Structural Guardrails

### G1: Data Schema per Template
Each template defines `data_schema` — allowed fields, types, required flags. Engine validates `ticket.data` against this on every INSERT/UPDATE.
- **Enforcement:** `validate_ticket_data()` BEFORE trigger on tickets. Rejects unknown fields, missing required fields, wrong types. Full type checking: boolean, number, text, uuid (format validated), timestamptz.

### G2: Frozen Condition Operator List
11 operators, frozen at launch: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `is_null`, `is_not_null`, `after_hours`, `all_of`, `any_of`.
- `gt`/`lt`/`gte`/`lte` are numeric only. Dates stored as epoch seconds for comparison.
- `after_hours` reads `ticket.waiting_since`, not `ticket.data`. Uses `_waiting` pseudo-field.
- **Enforcement:** `evaluate_condition()` raises EXCEPTION on unknown operators. Adding a new operator requires Adam's explicit approval + DECISIONS.md entry.

### G3: Template-Agnostic Engine
`compute_next_action` contains ZERO IF statements referencing specific template slugs. All template-specific logic lives in state machine data.
- **Enforcement:** Code review rule. Any `IF template = 'x'` in the engine is a reject. Verified in Step 8 via grep.

### G4: Naming Conventions
- State slugs: `verb_noun` or `adjective` (awaiting_contractor, cleaning_complete)
- Data fields: `noun_verb_past` (contractor_responded, cleaner_accepted)
- Template slugs: `noun_noun` (cleaning_turnover, guest_stay)
- **Enforcement:** Documented in CONVENTIONS.md. Verified in Step 8 audit.

### G5: Cross-Workflow Trigger Interface
Templates are isolated. Cross-workflow triggers only via `create_ticket` auto-action. New tickets get `parent_ticket_id` set. `create_ticket` on manual overrides requires human confirmation (`pending_confirmation` status).
- **Enforcement:** `parent_ticket_id` FK on tickets. `create_ticket` is the ONLY cross-workflow mechanism.

### G6: Decision Log
Every structural decision logged in DECISIONS.md with: the decision, alternatives, rationale.
- **Enforcement:** CLAUDE.md non-negotiable trigger: structural decision → DECISIONS.md in same commit.

### G7: Schema Truth Document
SCHEMA.md always reflects current table state. Updated with every migration.
- **Enforcement:** CLAUDE.md non-negotiable trigger: migration → SCHEMA.md in same commit. Verified in Step 8 by comparing against `\d` output.

---

## Audit Trail

### G8: Comprehensive Audit Trail
Every action logged and searchable: state transitions, actions fired, manual overrides, ticket creation, timeouts. Core product feature, not debugging tool.
- **Enforcement:** No action executes without a `ticket_events` record. If INSERT fails, transaction rolls back. Searchable by: ticket, property, contact, action type, date range, template.
- `transition_id` groups related events (state_changed + action_fired events from same transition).

---

## End User Protection

### G9: Stuck Ticket Detection
Every state has either `timeout_hours` + `on_timeout` or is a human gate (`needs_action`). Timeout fires before transitions.
- **Enforcement:** Engine checks timeout in `compute_next_action` before evaluating transitions. Late data handled by template design: timeout destination states include transitions for late arrivals.

### G10: Action Idempotency
Auto-actions logged before execution. UNIQUE constraint `(transition_id, action_type, recipient_key)` on action_queue prevents duplicates. `ON CONFLICT DO NOTHING`.
- **Enforcement:** DB-enforced. If trigger double-fires, second INSERT silently skipped.

### G11: Explicit Reversal (No Implicit Undo)
States define `manual_overrides` — explicit "move to X" actions. Logged as `manual_override` event type. Auto-actions fire on target state. `create_ticket` actions require human confirmation on manual override.
- **Enforcement:** `manual_override` RPC validates target against allowed overrides.

### G12: Notification Throttling
Actions queue to `action_queue`, not direct send. Comms layer drains queue with throttling rules.
- **Enforcement:** action_queue table exists from day one. Engine writes to it; comms layer reads from it.

### G13: Human-Readable Status
Every state has `display_template` — string with `{placeholders}` filled from ticket data and system fields. SSOT for user-facing text.
- **Enforcement:** `display_template` is NOT NULL on workflow_states.

---

## Builder Protection

### G14: Session Start Protocol
Every session reads: GUARDRAILS.md, SCHEMA.md, DECISIONS.md, ARCHITECTURE.md, ROADMAP.md. Enter plan mode. Agree scope.
- **Enforcement:** CLAUDE.md non-negotiable trigger.

### G15: Scope Lock + Active Enforcement
"This session: Step X. Nothing else." Out-of-scope → BACKLOG.md. Adam proposes adding scope → AI pushes back explicitly.
- **Enforcement:** CLAUDE.md non-negotiable trigger. Adam self-identified as at risk of scope creep.

### G16: Tests Pass Before Session Ends
Test script must pass for ALL existing workflows. No "fix it next time."
- **Enforcement:** Session-end checklist. Blocking.

### G17: Every Build = Test Plan + Reinforcement Audit
Session ends with: test plan (what was tested — see TESTS.md), reinforcement audit (SSOT check, naming check, guardrail check, decisions logged, docs in sync), ROADMAP.md step status updated.
- **Enforcement:** Session-end checklist in SESSION.md.

### G18: No Premature Optimisation
No indexes, caching, materialised views. Prototype proves logic, not performance.
- **Enforcement:** Forbidden until Step 8 at earliest.

### G19: Atomic Sessions
Every session leaves project working. `supabase db reset` clean. Tests pass. No half-written migrations.
- **Enforcement:** Session-end checklist.

### G20: Every Session Starts in Plan Mode
No code without a plan. Discuss scope, approach, affected files. Approve. Then build.
- **Enforcement:** CLAUDE.md non-negotiable trigger.
