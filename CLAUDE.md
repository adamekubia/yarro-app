# Yarro PM Dashboard — Developer Workspace

## Who You Are Helping

You are helping **Adam**, the sole developer on the Yarro PM dashboard. Adam owns all infrastructure (Supabase, Vercel, domain, Twilio, GitHub). He is building this into an HMO-focused property management platform.

## Your Role

- **Teaching mode**: Always explain what you are doing and why. Never silently write code — walk Adam through your reasoning.
- When Adam asks about code, explain the existing pattern first, then propose changes.
- Reference existing components and utilities before creating new ones. Check `.claude/docs/patterns.md`.
- Default to small, focused changes.
- If Adam seems confused, slow down. Explain the concept before the code.

---

## Session Startup

1. **Read `SESSION_LOG.md`** — check "Next Session Pickup" for pending work
2. **Check git state**: `git status` and `git branch` — any uncommitted work? Which branch?
3. **Ask Adam** what he wants to work on today
4. If work is pending from last session, mention it: "Last time we were working on X. Want to continue?"

---

## Caution Zones

These files are complex and have non-obvious behavior. Read thoroughly before modifying and back up first.

| File | Why It's Sensitive |
|------|-------------------|
| `supabase/functions/yarro-tenant-intake/` | WhatsApp intake state machine — `c1_context_logic` RPC drives conversation flow |
| `supabase/functions/yarro-tenant-intake/prompts.ts` | 1,550 lines of AI prompts. Backend code parses exact emoji + phrases. See `.claude/docs/hmo-pivot-plan.md` Section 10 for the list of load-bearing phrases |
| `src/contexts/pm-context.tsx` | Auth state provider — has race-condition fixes for Supabase GitHub issue #35754. Two-layer pattern (authUser + PM record) is intentional |
| `src/middleware.ts` + `src/lib/supabase/` | Auth session management — cookie refresh on every request. `getSession()` vs `getUser()` choice is deliberate |
| `types/database.ts` | Auto-generated from Supabase. Manual edits get overwritten on next type generation |
| `src/hooks/use-ticket-detail.ts` | Large hook (600+ lines) tightly coupled to DB schema. Fetches 5-7 queries in parallel |
| Database RPCs (`c1_context_logic`, `c1_create_ticket`, etc.) | Core business logic in PostgreSQL. Backed up in `.backups/supabase-export-2026-03-26/` |

---

## Git Workflow

**Remotes:**
- `origin` → `adamekubia/yarro-app` (your fork — primary)
- `upstream` → `Yarro-AI/yarro-app` (original org repo — pull only if still have access)

**Rules:**
1. Commit with clear prefixed messages: `feat:`, `fix:`, `style:`, `refactor:`
2. **Before pushing, always run:** `npm run build` (pre-push hook enforces this)
3. Push to `origin` (your fork)
4. Use feature branches for significant work, or push to `main` directly for small fixes

---

## Dev Commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build + TypeScript check
npm run lint         # ESLint check
```

---

## Before Claiming Done (Mandatory Checklist)

Run this before telling Adam a change is complete:

1. `npm run build` passes with zero errors
2. `npm run dev` — the change works visually in the browser
3. No errors in browser DevTools console
4. Responsive: check at mobile width (375px) and desktop (1440px)
5. Dark mode: verify it looks right in both light and dark themes
6. No hardcoded values that should come from constants or props
7. No `any` types or `@ts-ignore` in new code

---

## Current Project: HMO Pivot

Yarro PM is pivoting to focus on HMO (Houses in Multiple Occupation) property management.

See these docs for full context:
- `.claude/docs/hmo-pivot-plan.md` — phased build plan, what stays/changes/is new
- `.claude/docs/code-issues.md` — known code quality issues to fix incrementally

**Build order:**
1. ~~Phase 1: Compliance tracking (certificates, expiry dates, dashboard card)~~ **DONE**
2. **Phase 2: Room layer (rooms table, room assignment, size validation)** ← active
3. Phase 3: Room-aware tickets
4. Phase 4: Compliance automation + room-aware intake

---

## Product Vision & ICP

**What Yarro is becoming:**
Yarro is not a general property management tool. It is being built specifically for HMO (Houses in Multiple Occupation) letting agencies in the UK. The goal is to become the best maintenance coordination platform for this niche — not compete with broad tools like Fixflo, but to win the HMO segment by understanding the specific operational complexity of multi-tenant, room-based properties.

**The core positioning:**
"Yarro gives letting agencies complete control over their property maintenance by automating coordination so they never have to chase a job or a contractor again."

**Core USP:**
A complete audit trail that protects the agency when things go wrong — council inspections, rent withholding disputes, landlord complaints. Everything logged, timestamped, evidenced.

**Target customer (ICP):**
- UK letting agencies managing 100–500 units
- HMO-heavy portfolios (5+ bed shared houses, student lets, professional HMOs)
- Currently using CRMs with open APIs: AgentOS, Street.co.uk, Dezrez (avoid Alto and Jupix)
- Pain points: context switching between tools, always chasing contractors, things falling through cracks, no audit trail when disputes arise, landlords losing patience, unreliable contractors, out-of-hours emergencies, approval bottlenecks

**What makes HMO different from standard lettings:**
- Multiple tenants per property, each in their own room
- Shared areas (kitchen, bathroom, hallway) create ambiguity on who reports what
- Higher compliance burden: HMO licence, fire risk, EICR, gas safety all mandatory
- Room-level tracking matters — which room reported the issue, which tenant, which contractor visited
- Councils inspect HMOs. The audit trail is not a nice-to-have, it's legal protection

**Build decisions should always ask:**
- Does this serve an HMO agency specifically or is it generic?
- Does this reduce chasing, context switching, or compliance risk?
- Does this add to the audit trail or make it clearer?
- Would a Fixflo user switch to Yarro for this feature?

---

## Infrastructure

Adam owns everything:

| Service | Details |
|---------|---------|
| **Supabase** | Owner (`adam@yarro.ai`). Project ref: `qedsceehrrvohsjmbodc` |
| **Vercel** | Adam's account. Project: `yarro-pm`. Live at `yarro-pm.vercel.app` |
| **Domain** | `yarro.ai` on Namecheap. `app.yarro.ai` CNAME exists (currently points to Faraaz's Vercel — repoint when ready) |
| **Twilio** | Adam owns. Two WhatsApp numbers: `+447446904822` (inbound), `+447463558759` (outbound) |
| **GitHub** | Fork: `adamekubia/yarro-app`. Original: `Yarro-AI/yarro-app` |
| **Backups** | Supabase RPCs, triggers, cron jobs exported in `.backups/supabase-export-2026-03-26/` |

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
| `.claude/docs/architecture.md` | Understanding how Yarro works |
| `.claude/docs/patterns.md` | Before creating or modifying components |
| `.claude/docs/hmo-pivot-plan.md` | HMO pivot phases, build order, what stays/changes |
| `.claude/docs/code-issues.md` | Known code quality issues and priorities |
| `.claude/docs/setup-guide.md` | Environment setup reference |
| `.claude/docs/git-workflow.md` | Git operations reference |

---

## Key Principles

1. **Explain as you go** — Every code change is a teaching moment.
2. **Small changes** — One feature or fix at a time.
3. **Reuse existing patterns** — Check patterns.md before creating new components.
4. **Read before modifying** — Especially caution zone files. Understand why it's built that way before changing it.
5. **Back up before risky changes** — Especially database RPCs and Edge Functions.
