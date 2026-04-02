# Yarro PM Dashboard — Developer Workspace

## Who You Are Helping

You are helping **Adam**, the sole developer on the Yarro PM dashboard. Adam owns all infrastructure (Supabase, Vercel, domain, Twilio, GitHub). He is building this into an HMO-focused property management platform.

**Stack:** Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, Edge Functions) · Sonner · date-fns · next-themes

## Your Role

- **Teaching mode**: Always explain what you are doing and why. Never silently write code — walk Adam through your reasoning.
- When Adam asks about code, explain the existing pattern first, then propose changes.
- Reference existing components and utilities before creating new ones. Check `.claude/docs/patterns.md`.
- Default to small, focused changes.
- If Adam seems confused, slow down. Explain the concept before the code.

---

## Session Discipline

Five rules that keep builds focused and shippable. These are non-negotiable.

### Rule 1: One feature, one merge
Every build session produces one merge to main. At session start, check `.claude/tasks/` for incomplete PRDs (`Status: In Progress`). If one exists: "There's an unfinished task: **[name]**. Ship it (`/ship`) or abandon it before starting something new." Never start a new branch while a PRD is in progress without resolving it first.

### Rule 2: Branch from main
Every feature branch starts from `main`. No integration branches. No `feat/hmo-compliance`. No `style/demo-polish`. Each feature is atomic.
```
main (live, always working)
├── feat/[name]      — new feature
├── refactor/[name]  — cleanup
└── fix/[name]       — bug fix
```
Start: `git checkout main && git pull origin main && git checkout -b feat/[name]`
Finish: run `/ship`

### Rule 3: Guard the scope
Before implementing any change, check: is this in the active PRD? If the work isn't in the PRD's Technical Plan or Acceptance Criteria, say: "This isn't in today's scope. Add to backlog?" Only proceed if Adam explicitly expands the PRD — and update the PRD to reflect the change.

### Rule 4: Commit often
After modifying 3+ files without a commit, suggest: "We've changed N files — commit progress?" This is a nudge, not a blocker.

### Rule 5: Don't build during testing
When running a test plan and a test fails because a feature is missing, log the issue. Do NOT start building the missing feature. Say: "Test X failed because Y. Backlog it or is this a blocker for this PRD?" This prevents test sessions from becoming build sessions.

### Session Start
1. Read SESSION_LOG.md — check "Next Session Pickup"
2. Check git state: `git status` and `git branch`
3. Check `.claude/tasks/` for incomplete PRDs — enforce Rule 1
4. If pending work exists, mention it
5. Run `/scope` to create a PRD for today's build (or `/scope` lightweight for quick fixes)
6. Build starts only after Adam confirms the PRD

### Session End
Run `/ship` — this handles test plan, build, commit, merge, push, and session log.

### Branch Commands
```bash
# Start (always from main)
git checkout main && git pull origin main
git checkout -b feat/[name]

# Finish (run /ship, or manually)
git checkout main
git merge --no-ff feat/[name]
git push origin main
```

### Rule
Always branch from main. Always merge back to main.
No integration branches. One feature branch, one merge, ship it.

---

## Architecture Rules

### Backend-First — Non Negotiable
All business logic lives in Supabase RPCs, not the frontend.

Rules:
- Never put business logic in React components or hooks
- Never compute derived state (status, counts, summaries) in the frontend
- Always write an RPC for operations involving business logic
- Direct table access (.from().select()) only for simple reads
  with no logic involved
- Every new feature starts with the RPC, then the UI consumes it

### RPC Pattern
1. Write the SQL function in a new migration file
2. Test it in Supabase dashboard SQL editor first
3. Deploy via: supabase db push
4. Regenerate types: supabase gen types typescript --project-id qedsceehrrvohsjmbodc > src/types/database.ts
5. Build the UI to consume it

### Why This Matters For Yarro
- Security: logic never exposed to frontend
- Consistency: one source of truth for all clients
- Audit trail: database-level logging on every operation
- Performance: one round trip instead of many
- Scale: mobile app, API, WhatsApp bot all call same RPCs

---

## Caution Zones

These files are complex and have non-obvious behavior. Read thoroughly before modifying and back up first.

| File | Why It's Sensitive |
|------|-------------------|
| `supabase/functions/yarro-tenant-intake/` | WhatsApp intake state machine — `c1_context_logic` RPC drives conversation flow |
| `supabase/functions/yarro-tenant-intake/prompts.ts` | 1,550 lines of AI prompts. Backend code parses exact emoji + phrases. See `.claude/docs/hmo-pivot-plan.md` Section 10 for the list of load-bearing phrases |
| `src/contexts/pm-context.tsx` | Auth state provider — has race-condition fixes for Supabase GitHub issue #35754. Two-layer pattern (authUser + PM record) is intentional |
| `src/proxy.ts` + `src/lib/supabase/` | Auth session management — cookie refresh on every request. `getSession()` vs `getUser()` choice is deliberate |
| `src/types/database.ts` | Auto-generated from Supabase. Manual edits get overwritten on next type generation |
| `src/hooks/use-ticket-detail.ts` | Large hook (600+ lines) tightly coupled to DB schema. Fetches 5-7 queries in parallel |
| Database RPCs (`c1_context_logic`, `c1_create_ticket`, etc.) | Core business logic in PostgreSQL. Backed up in `.backups/supabase-export-2026-03-26/` |

### Protected RPCs — Hard Stop

There are 61 SQL functions that are **untouchable without Adam's explicit approval**.
They drive WhatsApp conversations, ticket creation, contractor dispatch, portal
authentication, cron jobs, and RLS policies.

**Before writing any new migration that uses `CREATE OR REPLACE FUNCTION`:**
1. Check `supabase/core-rpcs/README.md` for the full alphabetical list
2. If the function name appears there, **STOP and ask Adam**
3. Read the category file for that function to understand callers and dependencies

The full catalog lives at `supabase/core-rpcs/`. The deep reference
(dependency graph, trigger map, cron schedule) is at `.claude/docs/protected-rpcs.md`.

**Why this matters:** A `CREATE OR REPLACE` in a new migration silently
overwrites the previous version. There is no undo in production.
Functions like `c1_message_next_action` (9+ callers), `c1_msg_merge_contractor`
(11 callers), and `get_pm_id` (~33 RLS policies) will cascade failures
across the entire system if modified incorrectly.

**Key gotcha:** `c1_context_logic` and `c1_create_ticket` live in
`20260329000000_whatsapp_room_awareness.sql`, NOT in the main migration.

---

## Git Workflow

**Remotes:**
- `origin` → `adamekubia/yarro-app` (your fork — primary)
- `upstream` → `Yarro-AI/yarro-app` (original org repo — pull only if still have access)

**Rules:**
1. Commit with clear prefixed messages: `feat:`, `fix:`, `style:`, `refactor:`
2. **Before pushing, always run:** `npm test && npm run build` (pre-push hook enforces build)
3. Push to `origin` (your fork)

---

## Dev Commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build + TypeScript check
npm run lint         # ESLint check
npm test             # Run all unit tests once (Vitest)
npm run test:watch   # Run tests in watch mode (re-runs on file save)
```

---

## Before Claiming Done (Mandatory Checklist)

Run this before telling Adam a change is complete:

1. `npm test` passes with zero failures
2. `npm run build` passes with zero errors
3. Feature works visually in browser
3. Data persists on page refresh
4. No errors in browser DevTools console
5. Responsive: check at 375px mobile and 1440px desktop
6. Dark mode: looks right in both themes
7. No hardcoded values that should come from constants or props
8. No `any` types or `@ts-ignore` in new code
9. SESSION_LOG.md updated
10. New ideas captured in BACKLOG.md
11. Committed and pushed to task branch

---

## Current Project: HMO Pivot

Yarro PM is pivoting to focus on HMO (Houses in Multiple Occupation) property management. Phase 1 (compliance tracking) is complete. Phase 2 (HMO layer) is a 10-day sprint targeting demo-ready by ~11 April 2026.

### Build Specs

Product specs and build order live in `docs/`:

- `docs/PRD.md` — product requirements, core loop, demo scope
- `docs/BUILD-ORDER.md` — 10-day sprint plan, daily goals, done-when criteria
- `docs/schema/TECH-LEDGER.md` — full data schema, new tables, RPCs, edge functions
- `docs/modules/01-room-layer.md` — room layer spec (Days 1–4)
- `docs/modules/02-compliance-automation.md` — compliance automation spec (Days 6–7)
- `docs/modules/03-rent-tracking.md` — rent tracking spec (Days 8–9)
- `docs/modules/04-whatsapp-room-awareness.md` — WhatsApp room awareness spec (Day 5)

Before starting any build task, read the relevant module file + `docs/schema/TECH-LEDGER.md`.

### Known Issues

- `.claude/docs/code-issues.md` — code quality issues to fix incrementally

---

## Product Vision

Yarro targets R2R operators and small HMO landlords (3–20 units). Full context: `docs/PRD.md`

**Build decisions should always ask:**
- Does this serve an HMO agency specifically or is it generic?
- Does this reduce chasing, context switching, or compliance risk?
- Does this add to the audit trail or make it clearer?
- Would a Fixflo user switch to Yarro for this feature?

---

## Infrastructure

Adam owns all infra (Supabase, Vercel, Twilio, GitHub, domain). Details: `.claude/docs/infrastructure.md`

---

## End of Session

Update `SESSION_LOG.md`:

```markdown
## YYYY-MM-DD — [What was worked on]

### Summary
One paragraph of what happened.

### Changes Made
- List of files changed and why

### Status
- [ ] Build passes
- [ ] Tested locally
- [ ] Committed and pushed

### Next Session Pickup
1. Most important next step
2. Anything unfinished
```

---

## Reference Documentation

| File | When to Read |
|------|-------------|
| `docs/PRD.md` | Product requirements, core loop, demo scope |
| `docs/BUILD-ORDER.md` | Sprint plan, daily goals, what to build next |
| `docs/schema/TECH-LEDGER.md` | Data schema, RPCs, edge functions |
| `docs/modules/01–04-*.md` | Detailed spec for each feature module |
| `.claude/docs/architecture.md` | Understanding how Yarro works |
| `.claude/docs/patterns.md` | Before creating or modifying components |
| `.claude/docs/code-issues.md` | Known code quality issues and priorities |
| `.claude/docs/infrastructure.md` | Service credentials and URLs |
| `.claude/docs/setup-guide.md` | Environment setup reference |
| `.claude/docs/git-workflow.md` | Git operations reference |
| `.claude/tasks/BACKLOG.md` | Captured ideas for future sessions |
| `.claude/skills/morning-prd/SKILL.md` | Morning PRD skill definition |
| `supabase/core-rpcs/README.md` | Before writing ANY new migration |
| `.claude/docs/protected-rpcs.md` | Before planning changes to SQL functions |
| `docs/stability/` | Before modifying edge functions, migrations, or error handling |

