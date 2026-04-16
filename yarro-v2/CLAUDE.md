@AGENTS.md

# Yarro v2 — Production App

Data-driven workflow engine shipped as a production web app. Based on the proven engine in `../prototype/`. Design partner: Tutu (15 properties). Goal: a system more reliable than a VA — specifically, one that never fails at the things VAs fail at.

## Architecture (the system model — never violate)

Four layers, strict separation (same as prototype):
1. **Workflow Templates** — define what workflows exist (data in workflow_templates)
2. **Workflow States** — state machines per template (data in workflow_states)
3. **Tickets** — instances flowing through state machines. All workflow-specific data in `data` JSONB.
4. **Engine** — one function reads state machine data, evaluates conditions, transitions tickets.

Core invariants:
- Everything is a ticket. Every workflow type is a template. Templates are data, not code.
- Engine is template-agnostic. NEVER write IF statements referencing template slugs.
- Buckets are universal: `needs_action`, `waiting`, `scheduled`, `completed`, `archived`.
- Transitions are deterministic. No AI inference in state decisions.
- Audit trail is atomic. State change + event log + field updates succeed together or fail together.
- Comms are actions, not states. Auto-actions fire on state entry.

## The Product Pitch

**"Yarro doesn't drop the ball at month 4."**

Every VA failure Tutu described (miscounted legal dates, missed council emails, check-in before payment, no first-night guest check-in) is something deterministic software prevents by design. The MVP is not a dashboard — it's a system structurally incapable of those failures.

## Decision Framework (ask before every choice)

**SSOT check:** "Does this truth already have a home? Am I about to create a second source?"
**Template-agnostic check:** "Does this code reference a specific template/workflow/category name?" → If yes, wrong. Restructure.
**Strongest option check:** "Most architecturally sound, or just fastest?" Always strongest. Never patchy.
**Simplicity check:** "Can this be expressed with fewer states / simpler conditions / less abstraction?" More states with flat conditions beats fewer states with nested logic.
**User-pain check:** "Does this prevent a VA-failure Tutu mentioned?" If yes, higher priority.

## Non-Negotiable Triggers

- **Session start →** Read this CLAUDE.md + `docs/SCHEMA.md` + `docs/DECISIONS.md` + `docs/tutu-discovery/` + current sprint in plan file.
- **Adam proposes scope expansion mid-session →** Push back: "That's a separate session. Backlogging. Let's finish [current scope] first."
- **Writing a migration →** Read `docs/SCHEMA.md` first. Update in same commit.
- **Creating states/fields →** Follow naming conventions (verb_noun states, noun_verb_past data fields, frozen operator list).
- **Making structural decisions →** Log in `docs/DECISIONS.md` (D100+).
- **Noticing out-of-scope need →** Log in `docs/BACKLOG.md`. Don't act on it.
- **Session end →** Run build, run tests, reinforcement audit, commit.

## This IS a production app

- Real users (Tutu initially, then paying customers)
- Auth required (RLS on all tables)
- UI required (Next.js App Router, shadcn, semantic Tailwind tokens)
- Deployed (Vercel)
- Error boundaries, Sentry, real monitoring
- BUT: MVP is single-PM (Tutu). Multi-tenant polish deferred.

## Stack (Next.js 16 — breaking changes vs your training data)

- **Next.js 16.2.4** — read `node_modules/next/dist/docs/` before building routes/components. Heed deprecation notices.
- **React 19.2.4**
- **Tailwind 4** (note: Tailwind 4 differs significantly from v3)
- **Supabase** (new cloud project, not main project's)
- **Twilio** (reuse credentials/patterns from main project — don't rebuild)
- **shadcn/ui** — copy components individually from `../src/components/ui/` as needed

## Dev Commands

```bash
npm run dev           # Dev server
npm run build         # Production build + TS check
npm run lint          # (if added)
supabase db push      # Push migrations to cloud (remote)
```

## Reference (read, don't import)

- `../prototype/` — proven engine migrations + tests + SCHEMA.md + DECISIONS.md
- `../src/lib/supabase/` — auth patterns (adapt for new Supabase project)
- `../src/components/ui/` — shadcn components (copy as needed)
- `../src/app/(auth)/` — login UI pattern
- `../supabase/functions/yarro-dispatcher/` — Twilio outbound pattern
- `../supabase/functions/yarro-tenant-intake/` — Twilio inbound webhook pattern
- `../tailwind.config.ts` + `../src/app/globals.css` — brand tokens
- `docs/tutu-discovery/` — Tutu's voice notes + gap analysis
