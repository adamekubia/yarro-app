# Yarro Workflow Engine v2 — Prototype

Data-driven workflow engine where state machines are JSONB data, not code.
One universal engine runs unlimited configurable workflow templates.
Proving ground — separate from production. No UI, no auth. Engine only.

## Architecture (the system model — never violate)

Four layers, strict separation:
1. **Workflow Templates** — define what workflows exist (maintenance, cleaning, guest stay...)
2. **Workflow States** — define the state machine per template (states, transitions, actions)
3. **Tickets** — instances flowing through state machines. All workflow-specific data in `data` JSONB.
4. **Engine** — one function reads state machine data, evaluates conditions, transitions tickets.

Core invariants:
- Everything is a ticket. Every workflow type is a template. Templates are data, not code.
- Engine is template-agnostic. It NEVER checks which template a ticket belongs to. ZERO IF statements referencing template slugs.
- Buckets are universal: `needs_action`, `waiting`, `scheduled`, `completed`, `archived`. All templates map to these.
- Transitions are deterministic. Condition met → move. Not met → stay. No inference, no probability.
- Audit trail is atomic. State change + event log + field updates succeed together or fail together.
- Comms are actions, not states. "Send WhatsApp" fires on state entry. States describe position, not activity.

## Decision Framework (ask before every choice)

Before writing ANY code, pass it through these filters:

**SSOT check:** "Does this truth already have a home? Am I about to create a second source?"
→ If yes: use the existing source. Never duplicate.
→ SCHEMA.md = table truth. DECISIONS.md = choice truth. CONVENTIONS.md = naming truth.

**Template-agnostic check:** "Does this code reference a specific template, workflow type, or category name?"
→ If yes: it's wrong. Restructure so the logic works for ANY template.

**Strongest option check:** "Is this the most architecturally sound approach, or just the fastest?"
→ Always pick strongest. If it takes longer, it takes longer. Never patchy.

**Simplicity check:** "Can this be expressed with fewer states, simpler conditions, less abstraction?"
→ Prefer more states with simple flat conditions over fewer states with complex nested conditions.
→ If a condition needs AND/OR nesting beyond 1 level, add an intermediate state instead.

**SSOT build check:** "After this change, does SCHEMA.md match reality? Is DECISIONS.md current?"
→ If not: update them in the same commit. Not later. Now.

## Non-Negotiable Triggers (if X then Y, always)

These fire on specific events. They are not optional regardless of context:

- **Session start →** Read docs/GUARDRAILS.md + docs/SCHEMA.md + docs/DECISIONS.md + docs/ARCHITECTURE.md + docs/ROADMAP.md. Enter plan mode. Agree scope before writing code.
- **Adam proposes adding scope →** Push back: "That's a separate session. Backlogging it. Let's finish [current scope] first." Do not passively agree.
- **Writing a migration →** Read docs/SCHEMA.md first. Update SCHEMA.md in the same commit.
- **Writing engine logic, state definitions, or conditions →** Read docs/CONVENTIONS.md. Follow naming conventions, frozen operator list, JSONB formats, and nesting limits.
- **Making a structural decision →** Log it in docs/DECISIONS.md with rationale. Same commit.
- **Session end →** Run `supabase db reset` (must pass). Run test script (all green). Run reinforcement audit per docs/SESSION.md. Then commit. Update docs/ROADMAP.md step status.
- **Noticing something out of scope →** Log in docs/BACKLOG.md under the correct layer group. Do not act on it.

## This Prototype is NOT
- A production app (no auth, no RLS, no error boundaries)
- A UI project (no React, no pages, no components)
- A performance benchmark (no indexes, no caching)
- A complete product (one bulletproof workflow before adding the next)

## Dev Commands
```bash
npm test              # Run engine tests (tsx scripts/test-engine.ts)
npm run db:start      # Start local Supabase (port 55321)
npm run db:stop       # Stop local Supabase
npm run db:reset      # Reset + reapply all migrations
```

## Reference (parent project — read, don't import)
- `../supabase/migrations/20260410400000_*.sql` — current router + sub-routine pattern
- `../supabase/migrations/20260411400000_*.sql` — trigger 4-field write pattern
- `../docs/architecture/ticket-state-model.md` — three-layer model (bucket/state/timeout)
