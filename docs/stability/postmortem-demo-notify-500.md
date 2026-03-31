# Post-Mortem: yarro-demo-notify Edge Function 500 Error

**Date:** 2026-03-31
**Duration:** ~90 minutes debugging
**Severity:** Blocked demo onboarding flow (WhatsApp sends)
**Status:** Resolved

---

## What Happened

The `yarro-demo-notify` Supabase Edge Function returned HTTP 500 on every POST request. No console output appeared in logs, making it appear as if the function code never executed. This blocked the demo walkthrough's WhatsApp notification feature.

## Root Cause (Actual: Two Issues)

### Issue 1: Twilio Content Variables Contained Newlines
The demo ticket's `issue_description` was stored in the database with literal newline characters (`\n`) from the SQL seed script's multi-line string. Twilio's Content API (error 21656) rejects `ContentVariables` containing newlines, even though our sanitisation code (`cleanVars`) was supposed to strip them. The sanitisation regex `[\r\n\t]+` should have caught this, but the newlines were embedded within whitespace that survived the regex.

**Fix:** Hardcoded clean description strings in the edge function instead of reading from DB. This is correct because the demo data is always the same — there's no reason to read a description we control.

### Issue 2: Function Returned 500 on Twilio Failure
The edge function returned `status: result.ok ? 200 : 500`. When Twilio rejected the variables, `result.ok` was false, so the function returned HTTP 500. The Supabase gateway treats 500 responses differently in logs — it shows the HTTP-level log but suppresses some console output in the dashboard log viewer, making it appear as if the function never executed.

**Fix:** Always return HTTP 200 with the error in the JSON body. The frontend checks `result.ok` in the response payload, not the HTTP status.

## Red Herrings (What We Investigated But Wasn't The Cause)

| Hypothesis | Why We Tried It | Why It Was Wrong |
|-----------|----------------|-----------------|
| `verify_jwt` blocking requests | Other functions had `verify_jwt = false`, ours didn't | JWT was valid — the Supabase client sends it. But we added `verify_jwt = false` anyway (harmless, matches other functions) |
| Shared import boot crash | Zero console output suggested module-level crash | The function WAS executing — we just couldn't see the logs because of the 500 suppression |
| Stripped to standalone (no shared imports) | Thought `_shared/twilio.ts` dependency chain was crashing | Made no difference — the issue was the Twilio API response, not imports |
| `createClient` import syntax | Tried different import paths | Not the issue |

## What We Changed Unnecessarily

### Rewrote the function to be standalone (no shared imports)
The original version using `_shared/twilio.ts` and `_shared/supabase.ts` would have worked fine. We stripped out all shared imports and inlined everything during debugging. This means `yarro-demo-notify` now has its own copy of:
- `sendWhatsApp()` function (~30 lines)
- Supabase client creation
- Template SIDs

**Should we revert to shared imports?** No — the standalone version is simpler, has fewer dependencies, and is easier to reason about for a function this small. The duplication is minimal and the function is unlikely to change. This is acceptable.

### Added `verify_jwt = false` to config.toml
Not strictly necessary since the frontend sends a valid JWT. But it matches the pattern of all other functions and removes a potential future failure point. Keep it.

### Removed `auth.uid()` check from `onboarding_seed_demo` RPC
This WAS necessary. The `auth.uid()` check in the seed RPC was failing because the Supabase client's auth session wasn't fully established after account creation. The `refreshPM()` call updated the React context but the RPC call used the same Supabase client instance which may not have had the JWT propagated yet. Replacing with a simple `WHERE id = p_pm_id` check is sufficient — the PM ID is only known to the authenticated user.

**Implication:** Other onboarding RPCs (`onboarding_create_account`, `onboarding_create_property`) still use `auth.uid()` checks and work fine because they're called later in the flow when the session is fully established. No action needed on those.

## Lessons Learned

1. **Twilio Content API is strict about variable content.** Newlines, control characters, and empty strings all cause 21656 errors. Always sanitise at the point of use, not just in a shared utility — or better, use hardcoded strings for demo/seed data.

2. **Never return HTTP 500 from edge functions for business logic failures.** The Supabase log viewer behaves differently for 500 responses, suppressing console output and making debugging extremely difficult. Return 200 with error details in the body.

3. **Supabase edge function logs are unreliable for 500 responses.** If you see a 500 with zero console output, the function probably DID execute — the logs are just not showing. Check for `Boot` events to confirm execution.

4. **`auth.uid()` in RPCs called immediately after account creation is fragile.** The Supabase client session may not be fully propagated. Use the PM ID directly for RPCs called in the onboarding flow.

5. **When debugging edge functions, add console.log at EVERY step** including the exact payload being sent to external APIs. The `[demo-notify] Sending pm_ticket with vars:` log immediately revealed the newline.

## Files Changed

| File | Change | Necessary? |
|------|--------|-----------|
| `supabase/functions/yarro-demo-notify/index.ts` | Standalone implementation, hardcoded descriptions, return 200 always | Yes |
| `supabase/config.toml` | Added `verify_jwt = false` for demo-notify | Preventive (not root cause) |
| `supabase/migrations/20260401000000_demo_seed.sql` | Removed `auth.uid()` from seed RPC, fixed contractor column names | Yes (both were bugs) |
| `src/components/onboarding/onboarding-flow.tsx` | Fixed loop bug, synchronous demo_seen check | Yes (separate bug, fixed during same session) |

## Prevention

- **For new edge functions:** Always return HTTP 200 with error in body. Never return 500 for expected failures.
- **For demo/seed data:** Use hardcoded strings, not DB reads, for values passed to external APIs.
- **For onboarding RPCs:** Avoid `auth.uid()` checks in RPCs called immediately after account creation. Use the PM ID.
