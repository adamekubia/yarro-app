# Conventions — Workflow Engine v2

## Naming

### State slugs
Format: `verb_noun` or `adjective`
- Good: `awaiting_contractor`, `cleaning_complete`, `checked_in`, `scheduled`
- Bad: `waitingForContractor`, `clean_done`, `CHECKED_IN`

### Data fields
Format: `noun_verb_past`
- Good: `contractor_responded`, `cleaner_accepted`, `guest_checked_in`
- Bad: `hasContractorResponded`, `cleaner_response`, `checked`

### Template slugs
Format: `noun_noun`
- Good: `cleaning_turnover`, `guest_stay`, `contract_lifecycle`
- Bad: `cleanTurnover`, `guest-stay`, `ContractLifecycle`

---

## Frozen Operator List

Adding a new operator requires Adam's explicit approval + DECISIONS.md entry.

| Operator | Meaning | Value type | Notes |
|----------|---------|-----------|-------|
| `eq` | Equals | any | |
| `neq` | Not equals | any | |
| `gt` | Greater than | number | Numeric only. Dates as epoch. |
| `lt` | Less than | number | Numeric only. Dates as epoch. |
| `gte` | Greater or equal | number | Numeric only. Dates as epoch. |
| `lte` | Less or equal | number | Numeric only. Dates as epoch. |
| `is_null` | Field is null/missing | — | No `value` field needed |
| `is_not_null` | Field exists and not null | — | No `value` field needed |
| `after_hours` | Hours since waiting_since > value | number | `field` must be `_waiting` |
| `all_of` | All sub-conditions true | array | Max 1 level. Children are simple only. |
| `any_of` | At least one true | array | Max 1 level. Children are simple only. |

---

## JSONB Formats

### Transition
```json
{
  "to": "awaiting_booking",
  "when": { "field": "contractor_responded", "op": "eq", "value": true },
  "label": "Contractor accepts job"
}
```
- `to` — target state slug (must exist in same template)
- `when` — condition object (simple or compound)
- `label` — human-readable reason (logged in audit trail)

### Simple condition
```json
{ "field": "contractor_responded", "op": "eq", "value": true }
```

### Compound condition (max 1 level)
```json
{
  "all_of": [
    { "field": "contractor_responded", "op": "eq", "value": true },
    { "field": "quote_approved", "op": "eq", "value": true }
  ]
}
```
- `all_of` = AND. `any_of` = OR.
- Children must be simple conditions only. No nested compounds.

### Auto-action
```json
{
  "type": "send_message",
  "channel": "preferred",
  "to_role": "contractor",
  "template": "contractor_dispatch",
  "delay_hours": 0
}
```

### Frozen action types

| Type | Purpose | On manual override |
|------|---------|-------------------|
| `send_message` | Two-way conversation (AI responds to replies) | Fires immediately |
| `notify` | One-way outbound (status update, no reply) | Fires immediately |
| `create_ticket` | Cross-workflow trigger | Requires human confirmation |

### Manual override
```json
{
  "to": "new",
  "label": "Reset to new",
  "requires_reason": true
}
```

---

## Data Field Types (for data_schema)

| Type | JSONB type | Validation |
|------|-----------|------------|
| `boolean` | boolean | `jsonb_typeof = 'boolean'` |
| `number` | number | `jsonb_typeof = 'number'` |
| `text` | string | `jsonb_typeof = 'string'` |
| `uuid` | string | `jsonb_typeof = 'string'` + UUID format check |
| `timestamptz` | string | `jsonb_typeof = 'string'` (ISO format) |

---

## Condition Nesting Limit

Max 1 level of `all_of`/`any_of`. If you need deeper logic, add an intermediate state.

Bad:
```json
{ "all_of": [{ "any_of": [{ "field": "a", "op": "eq", "value": 1 }] }] }
```

Good: split into two states with simple conditions on each.
