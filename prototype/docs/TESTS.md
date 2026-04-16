# Tests — Workflow Engine v2

Test script: `scripts/test-engine.ts`
Run: `npm test`
Requires: local Supabase running (`npm run db:start`)

## Test Categories

### Workflow Scenarios (6)

| # | Name | Template | What it proves |
|---|------|----------|----------------|
| 1 | Maintenance: Happy path | maintenance | new → awaiting_contractor → awaiting_booking → scheduled → completed. 4 state_changed + 1 ticket_created events. |
| 2 | Maintenance: Decline → Reassign | maintenance | contractor_declined → clear flag + new name → awaiting_contractor again. Branching + recovery. |
| 3 | Maintenance: Timeout → Late reply | maintenance | 48h timeout → no_contractors → late reply → late_contractor_response → PM approves → continues. D019 late reply pattern. |
| 4 | Cleaning: Happy path | cleaning_turnover | pending → cleaner_notified → cleaning_confirmed → cleaning_in_progress → inspection_ready → completed. 5 transitions. send_message queued on cleaner_notified entry. |
| 5 | Cleaning: Decline → Reassign | cleaning_turnover | cleaner_declined_state → reassign → cleaner_notified. Same branching pattern, different template. |
| 6 | Cleaning: Overdue timeout | cleaning_turnover | 5h timeout → cleaning_overdue → late finish still reaches completed. |

### Guardrail Checks (7)

| # | Name | Guardrail | What it proves |
|---|------|-----------|----------------|
| 7 | Idempotency | G10 | Re-triggering recompute with unchanged data creates no new events. |
| 8 | Unknown field rejected | G1 | `bogus_field` in ticket data rejected by `validate_ticket_data`. |
| 9 | Type validation | G1 | String value for boolean field rejected. |
| 10 | Invalid override rejected | G11 | Manual override to non-allowed target state fails. |
| 11 | Terminal immutability | — | Data change on completed ticket creates no transitions. |
| 12 | Safe mutation | G12 → D012 | Deleting a workflow_state with open tickets is blocked by trigger. |
| 13 | Override requires reason | G11 | Override with `requires_reason: true` fails without reason, succeeds with one. |

## What a Green Run Looks Like

```
=== Yarro Engine v2 — Test Suite ===

  ✓ Maintenance: Happy path
  ✓ Maintenance: Decline → Reassign
  ✓ Maintenance: Timeout → Late reply
  ✓ Cleaning: Happy path
  ✓ Cleaning: Decline → Reassign
  ✓ Cleaning: Overdue timeout
  ✓ Guardrail: Idempotency
  ✓ Guardrail: Unknown field rejected
  ✓ Guardrail: Type validation
  ✓ Guardrail: Invalid override rejected
  ✓ Guardrail: Terminal immutability
  ✓ Guardrail: Safe mutation
  ✓ Guardrail: Override requires reason

13 passed, 0 failed
```

## Adding Tests

When adding engine logic, add tests that cover:
1. **Happy path** — the intended transition fires
2. **Rejection** — invalid input is blocked (data validation, override validation)
3. **Audit trail** — correct event types and counts logged
4. **Idempotency** — re-triggering doesn't duplicate
5. **Timeout** — backdate `waiting_since`, trigger recompute, verify timeout destination
