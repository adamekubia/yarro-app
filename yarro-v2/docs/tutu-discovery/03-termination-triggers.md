# 03 — What Actually Triggers Firing a VA

## Question asked
"When you decide to let them go, what's the actual trigger? Walk me through the last VA situation."

## Transcript
> So triggers that make us let them go, mismanaging guests when they're in there for a short period, resulting in them giving us either a bad review or a reduced full rate. So instead of it being five-star Airbnbs, it's four out of five. Instead of it being 10 on airbookers.com, it's like seven or eight out of 10. And it's not always to do with the cleaning, because the property is clean. It's to do with just not communicating. They raise issues and I think to myself, why didn't they, why didn't you find this out during their first night or the second, the first morning they woke up from our property? So that's that. And then just lack of literally, I'll probably keep saying this part, but lack of attention to detail. When they're with us that first few months, they're great. Everything's on point. And then they just start dropping the ball. And I just don't understand why. If the work is too much, they don't communicate and say, dude, I've got too much on my plate. If they've got personal stuff going on, I don't need to know the detail of your personal life. I just need to understand that personal stuff's going on and that could potentially affect you, your attention to detail in the role. So yeah, just these extra bits, like almost losing clients because of lack of attention to detail. We're supposed to serve a section 21 to a tenant for a property rent conference, for example. It's supposed to be a two months, with a section 21, you're supposed to give two months notice. With a section 21, she served it date March and the end in April 30th. Makes no sense. That's, that's one month notice. It's supposed to be two months. So I had to then go back to the the landlord and say, oh, we messed up. And now instead of them leaving April when the contract ends, they have to now leave two months from now. Same thing with a council tenant we're taking on. The council is very specific in the type of rent and deposit they pay. And then they didn't even see that email. Didn't see the email, probably lost in the thread of email. So again, I have to then have a call with the council and say, hey, I have to take the blame. You know, I have to take the blame almost because I'm telling you that will be paying us well because of lack of attention to detail and not reading contracts and not reading instructions or following instructions very clear. So yeah, that's what triggers us letting them go. And we've done this too many times to count.

## Firing triggers (ranked by damage)

### 1. Bad reviews from guest mismanagement (business-critical)
- Airbnb 5-star → 4-star
- Booking.com 10 → 7-8
- Cause: "Not finding out issues during first night or first morning"
- Root cause: **failure of proactive check-in**

### 2. Catastrophic legal/procedural errors (compliance risk)
- **Section 21 served with 1 month notice instead of 2** — landlord can't evict on time
- Tutu had to eat the cost: tenant stays 2 extra months
- This is a pure date calculation error. Software never gets this wrong.

### 3. Missed email / dropped signal (client relationship damage)
- Council tenant email with specific rent/deposit rules
- VA missed it in a thread
- Tutu had to take the blame with the council
- Near-loss of a client

### 4. Performance decay over time
- "First few months they're great. Then they drop the ball."
- Pure human problem: motivation, burnout, life happening
- **Tutu has done this "too many times to count."** 10 VAs in a year confirms the pattern.

## Product implications

### The product promise: "Yarro doesn't drop the ball at month 4"
This is THE pitch against VAs. Software doesn't:
- Burn out
- Have personal stuff going on
- Lose motivation
- Miss details when tired
- Forget to read contracts
- Miscalculate legal deadlines

Every one of Tutu's firing triggers is a thing deterministic software prevents by design.

### Proactive guest check-in = preventing bad reviews
Specific timing revealed in this voice note:
- Guest checks in
- T+ ~4-6 hours: "How are you settling in? Any issues?"
- T+ ~morning of Day 2: "How was your first night?"
- Reactive handling thereafter

Bad reviews come from issues discovered too late. If we surface issues during the first night, Tutu can fix them before the guest writes the review.

### Legal notice workflows need rule-based generation
Section 21 workflow:
- Input: serve date
- Rule: minimum 2 months statutory notice
- Output: end_date = serve_date + 2 months (at earliest)
- Generate notice with correct dates
- Human approves, but can't author dates wrong

This is a **templated legal document workflow** — different from contracts (which Tutu has pre-made). Notices have mathematical rules. System computes, human approves.

### Tenant type routing (council vs private)
"Council is very specific in the type of rent and deposit they pay."

Implication: the system needs to know tenant TYPE and apply the right rules. This is a data model thing — `tenant_type` field on contacts, with associated workflows. Council tenants go through a different onboarding than private tenants.

### Email ingestion parity with WhatsApp
Voice note 2 flagged WhatsApp group chat monitoring. This note adds **email**. Tutu's signals come from multiple channels:
- WhatsApp (tenants, guests, group chats)
- Email (council, other business)
- Airbnb/Booking.com messages (guests)

The ingestion layer needs to handle all of these, with intent classification routing messages to the right workflows.

## New workflows / templates revealed

| # | Workflow | Trigger | Key rule |
|---|----------|---------|----------|
| 1 | Guest proactive check-in (timed) | Guest checkin complete | Send at T+4-6h and T+24h "how's it going?" messages |
| 2 | Section 21 notice generation | PM initiates | Minimum 2-month period, date computed not typed |
| 3 | Council tenant onboarding | New council tenancy | Specific rent/deposit structure, validated rules |
| 4 | Private tenant onboarding | New private tenancy | Standard rules |
| 5 | Post-stay review monitoring | Guest checkout | Watch for review, flag if <5-star for Tutu's response |

## Engine implications

### New pattern: scheduled auto-action chains
Our engine has `delay_hours` on auto-actions. For guest proactive check-in:
- State: `checked_in`
- Auto-action 1: send_message "welcome" (delay 0)
- Auto-action 2: send_message "settling in check" (delay 4h)
- Auto-action 3: send_message "morning check" (delay 24h)

Current engine supports this. Just need to USE it. ✓

### New pattern: computed data fields
For Section 21: when the notice state is created, `end_date` should be auto-computed from `serve_date + 2 months`. Not user-entered.

This might require a new mechanism. Currently `update_data` action was removed (D015). We need either:
- A creation-time compute (when creating the ticket, derive end_date from serve_date)
- OR a new `compute_field` action type (like update_data but enforced by rules, not arbitrary)

This is a design decision to flag. Opening question.

### Pattern: data field validation rules beyond type
Type checking (D021) catches wrong types. But Section 21 needs: "end_date must be ≥ serve_date + 2 months". That's a **semantic validation rule**, not a type rule.

Options:
- Validation functions per template
- CHECK-style constraints in data_schema
- Server-side validation in the workflow RPC

Another design decision.

## Gap analysis updates
See [gaps-analysis.md](./gaps-analysis.md)

## Open questions
See [open-questions.md](./open-questions.md)
