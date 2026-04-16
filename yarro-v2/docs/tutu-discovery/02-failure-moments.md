# 02 — Exact Moments Tutu Steps In

## Question asked
"What are the exact moments you find yourself stepping in because they're not doing it right?"

## Transcript
> So the exact moment I find myself stepping in is when they are not taking initiative, especially when they're seeing conversations in group chats, they're not staying up to date when the tenant's moving in and tenants have signed a contract, why haven't they chased the tenant up? You know, what else do I find myself stepping into? Basic things like they should, I'm not even sure what else I could say here. You know, just taking that genuine initiative when doing payout breakdowns. I understand doing the first month, it might be a bit confusing, but once you've done it over and over again, it should be very straightforward. Attention to detail when it comes to contracts. I shouldn't have to always be reviewing it if you've done these contracts over and over and over again. You should be asking me what extra details needs to go into the contract before they send it off to the client or to the tenant that's supposed to be moving in. Same thing with attention to detail when it comes to the accounts. The account information should be correct that they are sending out to guests and tenants who are going to be paying before they move in and making sure that they get confirmation that payment has been sent before any check-in instruction is sent out. They can check with us, we can check the business bank account. Yeah.

## What Tutu's VAs fail at (verbatim)

1. **Not taking initiative** — seeing conversations in group chats and not staying up to date
2. **Not chasing tenants** after contracts are signed (move-in prep)
3. **Getting payout breakdowns wrong repeatedly** — even after doing it many times
4. **Attention to detail on contracts** — he has to review everything because they don't ask "what extra details?"
5. **Sending wrong account information** — bank details going out to guests/tenants for payment
6. **Sending check-in instructions before payment is confirmed** — premature release of access

## Product implications

### These are all determinism problems
Every failure above is something a deterministic engine can fix:
- "Not chasing" → auto-reminder on schedule (engine does this natively with timeouts)
- "Wrong payout breakdowns" → data validation + templated output (no creative mistakes)
- "Wrong account info" → single source of truth for payment details (not re-typed each time)
- "Check-in before payment" → state machine with explicit payment gate (can't transition to checkin-sent without payment_confirmed=true)

Humans forget, get distracted, copy-paste wrong numbers. Software doesn't.

### The payment gate is critical
> "Making sure that they get confirmation that payment has been sent before any check-in instruction is sent out."

This is a **hard state machine rule**, not a guideline. The check-in workflow must have:
- A state: `awaiting_payment_confirmation`
- Gate condition: `payment_confirmed = true`
- Only then transition to `sending_checkin_instructions`

We can't rely on a human to remember this. The template enforces it.

### Payout breakdowns are templated, not freeform
> "Once you've done it over and over again, it should be very straightforward."

Implication: the payout breakdown is the **same structure every month**. Only the numbers change. This is perfect for:
- A template that computes the breakdown from underlying data (rent ledger, expenses, fees)
- Auto-generates a PDF or message with the standard format
- Human reviews but doesn't author

### Group chat monitoring is a specific capability
> "Seeing conversations in group chats, they're not staying up to date."

Tutu's VAs are supposed to be watching WhatsApp group chats (tenants, guests, contractors, cleaners) and acting on what they see. This is a **signal detection problem**. When the engine ingests group chat messages:
- Tenant mentions a repair needed → create maintenance ticket
- Guest asks a question → create guest comms ticket
- Cleaner says a job is done → update relevant ticket

The engine can do this far more reliably than a human scrolling feeds.

### "Asking what extra details" — human-in-the-loop
> "You should be asking me what extra details needs to go into the contract."

Tutu WANTS to be asked. He doesn't want the system to guess. This is a **confirmable action pattern** — when the contract workflow reaches a state where data is incomplete, it prompts Tutu: "Here are the standard fields, is there anything specific for this contract?" Same pattern as our `pending_confirmation` design for create_ticket on manual overrides.

## Workflow implications

### New templates needed (or revised):

1. **Move-in coordination** (NEW)
   - States: contract_signed → awaiting_first_payment → payment_confirmed → checkin_instructions_sent → moved_in
   - Auto-chase reminders for payment
   - Hard gate: no checkin instructions until payment confirmed
   - Auto-send checkin instructions once gate is cleared

2. **Contract workflow** (NEW)
   - States: contract_requested → needs_extra_details (gate to Tutu) → ready_to_send → awaiting_signature → signed → filed
   - At "needs_extra_details," the ticket blocks in needs_action and shows Tutu the standard fields + asks if anything extra

3. **Monthly payout** (NEW — may not be ticket-shaped)
   - Scheduled generation (cron)
   - Pulls from rent_ledger, expenses, fees
   - Produces standardised breakdown
   - Sends to recipient(s)
   - Needs a data model for recipients, fee structures, etc. — bigger than a template

4. **Group chat monitor** (NEW — infrastructure, not a template)
   - Webhook receives group chat messages
   - AI layer classifies message intent
   - Routes to correct workflow (creates new ticket, updates existing ticket, or surfaces to Tutu)

## Gap analysis updates
See [gaps-analysis.md](./gaps-analysis.md) — I'll update that file with these new gaps.

## Open questions raised
See [open-questions.md](./open-questions.md).
