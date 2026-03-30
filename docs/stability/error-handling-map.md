# Error Handling Map

Layer-by-layer breakdown of where errors are caught, where they're not, and what the user sees in each failure scenario.

---

## 1. Middleware (`src/lib/supabase/middleware.ts`)

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| Supabase unreachable | No | Raw 500 error page |
| JWT expired (valid refresh token) | Yes — `getUser()` auto-refreshes | Normal page load |
| JWT expired (no refresh token) | Yes — `getUser()` returns null | Redirect to `/login` |
| User on protected page without auth | Yes | Redirect to `/login` |
| User on `/login` while authenticated | Yes | Redirect to `/` |

**Key:** Middleware runs on every request. If it fails, nothing renders.

---

## 2. PM Context (`src/contexts/pm-context.tsx`)

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| `getSession()` returns no user | Yes — sets authUser to null | Dashboard layout redirects to `/login` |
| PM record fetch fails (network) | Yes — catch block sets PM to null | "Loading..." forever (no toast) |
| PM record fetch returns null (no PM) | Yes — PM stays null | Redirect to `/import` |
| `onAuthStateChange` fires SIGNED_OUT | Yes | userId/authUser cleared, dashboard redirects |
| Tab becomes visible, no session | Yes | Hard redirect to `/login` |
| Tab becomes visible, user changed | Yes | userId updated, PM refetched |
| Logout POST fails | Caught but swallowed | Redirects to `/login` anyway (server session may persist) |

**Gap:** PM fetch failure has no user feedback — just silent null + "Loading..." state.

---

## 3. Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| No authUser | Yes | "Redirecting to login..." |
| No propertyManager (not on /import) | Yes | "Redirecting to onboarding..." |
| Property count check fails | Caught but swallowed | Continues to dashboard (may be empty) |
| Trial expired | Yes | Redirect to `/billing` |
| Render error in child page | Yes — ErrorBoundary | "Something went wrong" with retry |
| Async/data error in child page | No — ErrorBoundary doesn't catch async | Unhandled rejection in console |

---

## 4. Dashboard Page (`src/app/(dashboard)/page.tsx`)

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| Any of 9 queries fails | **Yes** (fixed 2026-03-30) | Toast: "Could not load dashboard. Please refresh." |
| Individual RPC returns error (but promise resolves) | Partially — null coalescing (`?? 0`) prevents crashes | Zeros in stat cards, empty lists |
| RPC doesn't exist (migration not deployed) | Yes — caught by try/catch | Toast error message |
| Supabase timeout on one query | Yes — caught by try/catch | Toast error message |

**Note:** Supabase client `.rpc()` and `.from()` calls don't throw — they return `{data, error}`. The `Promise.all` would only reject if the HTTP request itself fails (network error, DNS failure, etc.). Individual RPC errors return as `error` properties on the resolved value, not rejections.

---

## 5. Edge Functions — Telegram Alert Chain

All edge functions use the same pattern: on failure, alert Telegram, return 200.

### `yarro-tenant-intake`

| Step | What Fails | Alert Fires? | User Impact |
|------|-----------|-------------|-------------|
| `c1_context_logic` RPC | Yes — Telegram | Tenant gets no reply to their WhatsApp message |
| OpenAI call | Yes — Telegram + fallback message to tenant | Tenant sees "Sorry, I'm having a temporary issue" |
| `c1_convo_append_outbound` | Yes — Telegram | Message sent but not logged (conversation history gap) |
| `c1_convo_finalize` | Yes — Telegram, returns early | Conversation stuck open, no ticket created |
| `c1_create_ticket` | Yes — Telegram | Conversation closed, ticket lost (see AD-7) |
| Image upload | Logged, continues | Ticket created but images missing (Twilio URLs expire) |
| Notification trigger | Yes — Telegram | Ticket created but PM never notified |
| Unhandled exception | Yes — top-level catch | Function returns 200, tenant gets no reply |

### `yarro-ticket-notify`

| Step | What Fails | Alert Fires? | User Impact |
|------|-----------|-------------|-------------|
| `c1_ticket_context` RPC | Yes — Telegram, returns 500 | Caller (tenant-intake) sees error, alerts again |
| OOH contact fetch | Yes — Telegram, falls through to normal dispatch | OOH contacts may not be notified |
| SMS send (Twilio) | Logged via `sendAndLog` | PM/tenant/contractor not notified |
| Dispatcher trigger | Yes — Telegram | Ticket created, notified, but contractors never called |

### `yarro-dispatcher`

| Step | What Fails | Alert Fires? | User Impact |
|------|-----------|-------------|-------------|
| Ticket lookup (`.single()`) | No — crashes | Function returns 500, caller alerted |
| SMS send | Yes — Telegram | Contractor not contacted |
| `c1_contractor_mark_sent` | Yes — Telegram | SMS sent but not recorded (may cause re-sends) |

### Telegram Alert Reliability

**Critical weakness:** `alertTelegram()` returns `{ok, error}` but callers never check the result. If the Telegram bot token expires, rate limits, or the API is down — all error monitoring goes silent. There is no fallback (no database logging, no email).

---

## 6. Custom Hooks

### `use-ticket-detail.ts`

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| `c1_ticket_context` RPC fails | Yes — throws, sets error state | "Failed to load ticket details" |
| Secondary queries fail (conversations, messages, etc.) | Logged to console only | Empty panels, no error message |
| RPC returns null context | Partial — sets basic to null | Blank ticket panel |

### `use-edit-mode.ts`

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| `onSave()` callback fails | Yes — try/catch, sets error state | Error message in form |

---

## 7. Portal Pages

| Scenario | Caught? | User Sees |
|----------|---------|-----------|
| Invalid token | Yes — RPC returns null/error | "Invalid or expired link" message |
| Token RPC itself fails | Varies by portal | Raw error or blank page |
| File upload fails (contractor photos) | Yes — error toast | Upload button re-enabled |

---

## Summary: Biggest Gaps

1. **PM context failures are silent** — user gets stuck on "Loading..." with no feedback
2. **Dashboard layout swallows onboarding check errors** — may show empty state
3. **Telegram is a single point of failure** for all error monitoring
4. **No `error.tsx` files** — server-side rendering errors show raw stack traces
5. **Secondary query failures in ticket detail** are only console-logged
