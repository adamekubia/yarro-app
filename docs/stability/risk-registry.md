# Risk Registry

All identified risks from the 2026-03-30 stability audit. Update this as issues are fixed or new ones found.

**Status key:** Open = unresolved | Fixed = code change deployed | Accepted = known, won't fix (by design) | Backlog = tracked for future session

---

## Critical

| ID | Issue | File | Impact | Status | Date |
|----|-------|------|--------|--------|------|
| C1 | Dashboard `Promise.all` has no error handling — any RPC failure freezes the page | `src/app/(dashboard)/page.tsx:166` | All dashboard users see infinite loading | **Fixed** (2026-03-30) | 2026-03-30 |
| C2 | 3 new RPCs may not be deployed to production | migrations `20260331*` | Dashboard crashes if RPCs don't exist | **Pending verification** | 2026-03-30 |

## High (Pre-existing — Faraaz's code)

| ID | Issue | File | Impact | Status | Date |
|----|-------|------|--------|--------|------|
| H1 | Ticket creation fails after conversation finalize — ticket lost, conversation closed | `yarro-tenant-intake:412-523` | Tenant issue disappears, requires manual recovery | Accepted (AD-7) | 2026-03-30 |
| H2 | Telegram alerts can silently fail — callers never check the return value | `_shared/telegram.ts` | If Telegram bot is down, all error monitoring goes dark | Open | 2026-03-30 |
| H3 | Conversation append failure — message sent to tenant but not logged | `yarro-tenant-intake:400-406` | Conversation history corrupted, AI loses context | Open | 2026-03-30 |

## Medium

| ID | Issue | File | Impact | Status | Date |
|----|-------|------|--------|--------|------|
| M1 | No `error.tsx` files — server errors show raw Next.js error page | `src/app/` | Users see ugly stack traces | Backlog | 2026-03-30 |
| M2 | PM context fetch failure is silent — no toast, user stuck on "Loading..." | `pm-context.tsx:64-68` | User can't access dashboard, no feedback | Backlog | 2026-03-30 |
| M3 | Dashboard layout silently swallows onboarding check errors | `layout.tsx:55-57` | User may see empty dashboard instead of redirect | Backlog | 2026-03-30 |
| M4 | Ticket `pending_review` update has no error check | `tickets/page.tsx:299` | Flag silently not cleared, ticket stuck in wrong state | Backlog | 2026-03-30 |
| M5 | `yarro-dispatcher` uses `.single()` instead of `.maybeSingle()` | `yarro-dispatcher:427` | Crashes on missing ticket instead of handling gracefully | Open | 2026-03-30 |

## Low

| ID | Issue | File | Impact | Status | Date |
|----|-------|------|--------|--------|------|
| L1 | RLS policy on `c1_compliance_requirements` uses `auth.uid()` instead of `get_pm_id()` | migration `20260330100000:29` | Cosmetic inconsistency — functionally identical since `get_pm_id()` returns `auth.uid()` | Accepted | 2026-03-30 |
| L2 | `email!` non-null assertion in PM context | `pm-context.tsx:84,97` | Could crash if Supabase returns null email | Open | 2026-03-30 |
| L3 | Null context values render as "null" string in AI prompts | `yarro-tenant-intake:340-350` | AI receives malformed prompt with literal "null" | Open | 2026-03-30 |
| L4 | Logout fetch failure silently swallowed | `pm-context.tsx:147` | User thinks they logged out but server session persists | Open | 2026-03-30 |
