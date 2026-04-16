# 01 — Roles Being Hired For

## Question asked
"What specific roles are you hiring for?"

## Transcript
> Okay, so the first question, what specific role or roles are you hiring for? So the roles I'm hiring for, yeah, guest communication, tenant communication, yeah, coordinating all the check-ins, speaking with cleaners to make sure that cleaners are always up to date with what's going on and make sure they're cleaning the property when guests check in and check out, when tenants raise issues, making sure the right person is contacted or the landlord is aware of the issues if it's a landlord responsibility. What else? And, yeah, contracts, client payout breakdowns, contracts will need to be done from time to time when we take on new properties or when we are onboarding new tenants into a property, they'll need to sign some documentation. We also need to collect some other information as well.

## Clarifications (follow-up from Adam)
1. **Guest communication is both proactive AND reactive.** Proactive is where VAs have been failing him. Reactive is typically: directions, how to use things, wifi codes, etc.
2. **Client payout breakdowns:** scheduled, monthly.
3. **Contracts:** Tutu has pre-made templates. They just need to be filled in with correct details (property, tenant, dates, etc.). No drafting required.

## Workflow types revealed

| # | Workflow | In current v2? | Notes |
|---|----------|---------------|-------|
| 1 | Guest communication (proactive + reactive) | No | Two modes: proactive check-ins on schedule, reactive responses to questions |
| 2 | Tenant communication | No | Similar concept, different population (long-term) |
| 3 | Check-in coordination | No | New guest arrivals specifically |
| 4 | Cleaner ongoing sync | Partial | We have `cleaning_turnover`. Tutu also wants ongoing updates, not just per-turnover |
| 5 | Maintenance triage with landlord routing | Partial | We have maintenance. Missing: "is this a landlord responsibility?" branch |
| 6 | Contract generation + signing | No | Pre-filled from templates. Sent to tenant/landlord. Track signature. |
| 7 | Onboarding info collection (tenant) | No | Tied to contracts but also "other information" — structured form |
| 8 | Property onboarding (landlord contract) | No | When taking on a new property |
| 9 | Monthly payout breakdowns | No | Scheduled, cron-like — not ticket-triggered |

## Key tension: proactive vs reactive

VAs failed at proactive side. This is a critical product insight. If the engine can automate proactive touchpoints (scheduled check-ins, scheduled reminders) without depending on a human to remember, it's an immediate win over what he has.

Proactive = engine-initiated auto-actions on schedule. Reactive = human-initiated messages that arrive via webhook and need to be processed/responded to.

Both have to work. Our engine is ready for proactive (auto-actions + delays). Reactive needs the comms webhook + AI message parsing layer.

## Data collection insight

"Other information as well" during onboarding suggests a **form/checklist workflow pattern.** A ticket where each state represents an info field or group being collected. This fits our engine fine — states = stages, data = info collected, transitions fire when fields populate.

## Implications for v2 scope

- We designed 2 templates for the prototype. Tutu needs **~7-8 templates** minimum to cover his operation.
- Some (like monthly payouts) may not even fit the ticket pattern — they're scheduled reports.
- Comms layer (WhatsApp in + out) is non-negotiable for this to feel like a VA replacement.
- Onboarding/contracts flow is more critical than I assumed — every new property and tenant goes through it.
