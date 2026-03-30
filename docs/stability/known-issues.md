# Known Issues

Tracked issues from the 2026-03-30 stability audit and subsequent sessions. Items here are either backlogged for future work or accepted as known limitations.

**Status key:** Backlog = fix in a future session | Accepted = known, won't fix | Fixed = resolved

---

## Backlog (Fix in Future Sessions)

### B1: Add error.tsx files
- **Severity:** Medium
- **Files:** `src/app/(dashboard)/error.tsx` (create), `src/app/error.tsx` (create)
- **Issue:** No Next.js error boundaries exist. Server-side rendering errors show raw stack traces to users.
- **Fix:** Create `error.tsx` files with "Something went wrong" UI and retry button. Must be `'use client'` components.

### B2: Dashboard layout — toast on onboarding check failure
- **Severity:** Medium
- **File:** `src/app/(dashboard)/layout.tsx:55-57`
- **Issue:** If the property count check fails, the error is silently swallowed. User may see an empty dashboard instead of being redirected to onboarding.
- **Fix:** Add `toast.error('Could not check account status')` in the error branch.

### B3: PM context — toast on fetch failure
- **Severity:** Medium
- **File:** `src/contexts/pm-context.tsx:64-68`
- **Issue:** If PM record fetch fails, the catch block silently sets propertyManager to null. User sees "Loading..." forever.
- **Fix:** Add error state + toast in the catch block. Consider a retry mechanism.

### B4: Ticket pending_review — add error check
- **Severity:** Medium
- **File:** `src/app/(dashboard)/tickets/page.tsx:299`
- **Issue:** `supabase.from('c1_tickets').update({ pending_review: false })` has no error check. If the update fails, the flag stays set and the ticket appears stuck.
- **Fix:** Add `if (error) toast.error(...)` after the update call.

---

## Pre-Existing Bugs (Faraaz's Code)

### P1: Double `+` in landlord WhatsApp number causes SMS failure
- **Severity:** Medium
- **Files:** `supabase/functions/_shared/twilio.ts`, `supabase/functions/yarro-ticket-notify/index.ts`, `supabase/functions/yarro-dispatcher/index.ts`
- **Issue:** Landlord SMS sends fail with `The 'To' number whatsapp:++447700100001 is not a valid phone number`. A `+` prefix is being added to a phone number that already starts with `+`. Twilio returns HTTP 400.
- **Observed:** 2026-03-28 through 2026-03-30, same landlord (`+447700100001`), same property ("14 Brixton Hill"). Tickets ARE created — only the landlord notification fails.
- **Fix:** Phone normalization needs to strip any existing `+` before prepending, or check for it. Likely in `sendAndLog()` or the WhatsApp template send logic.
- **Owner:** Faraaz (edge function code)

### P2: Compliance reminder status alerts sent to Telegram as warnings
- **Severity:** Low (noise, not a bug)
- **Files:** `supabase/functions/yarro-compliance-reminder/`
- **Issue:** The compliance reminder cron function uses `alertTelegram()` to report its run status ("3 sent, 0 dispatched, 0 failed"). These appear alongside actual errors, causing alarm. They're informational — `0 failed` means success.
- **Fix:** Either change to a different reporting channel, suppress when 0 failed, or use a distinct Telegram message format (e.g. `ℹ️` instead of `⚠️`).
- **Owner:** Faraaz (edge function code)

---

## Accepted (Known Limitations)

### A1: Two-phase ticket creation can lose tickets
- **Severity:** High (but deliberate)
- **File:** `supabase/functions/yarro-tenant-intake/index.ts:408-523`
- **Issue:** Conversation finalize runs before ticket creation. If ticket creation fails, conversation is closed and ticket is lost.
- **Why accepted:** See [AD-7](architecture-decisions.md). Finalizing first prevents dangling conversations. Telegram alert fires for manual recovery.

### A2: Telegram alerts are single point of failure
- **Severity:** High
- **File:** `supabase/functions/_shared/telegram.ts`
- **Issue:** All error monitoring depends on Telegram. If the bot token expires or Telegram is down, all alerts fail silently.
- **Why accepted:** Adding a database fallback log would require schema changes and additional complexity in every edge function. Monitor the Telegram bot health separately.

### A3: RLS inconsistency on compliance_requirements
- **Severity:** Low
- **File:** `supabase/migrations/20260330100000_compliance_workflow_mvp.sql:29`
- **Issue:** Uses `auth.uid()` directly instead of `get_pm_id()`. All other tables use `get_pm_id()`.
- **Why accepted:** `get_pm_id()` returns `auth.uid()` — functionally identical. Not worth a migration to fix a cosmetic inconsistency.
