# Gaps Analysis — Tutu's Needs vs Current v2 Build

What we've built so far (prototype) vs what Tutu actually needs. Updated as voice notes come in.

## Workflow templates

| Workflow | Prototype has it? | Gap |
|----------|------------------|-----|
| Maintenance (reactive) | ✓ (11 states) | Missing: landlord responsibility routing |
| Cleaning turnover (calendar) | ✓ (9 states) | Possibly missing: ongoing cleaner sync outside turnovers |
| Guest communication — proactive | ✗ | Scheduled check-ins (arrival, mid-stay, pre-departure). Key pain point. |
| Guest communication — reactive | ✗ | Inbound questions (wifi, directions, how-to). Needs AI parsing + response. |
| Tenant communication | ✗ | Similar to guest but longer-term context |
| Check-in coordination | ✗ | New arrival sequence (may overlap with guest comms) |
| Move-in coordination (NEW — 02) | ✗ | Contract signed → payment → checkin instructions. HARD PAYMENT GATE. |
| Contract generation + signing | ✗ | Pre-filled from templates. Track signature. "Needs extra details" gate to Tutu. |
| Tenant onboarding info collection | ✗ | Structured data collection (form-like) |
| Property onboarding | ✗ | Landlord contract when taking on new property |
| Monthly payout breakdowns | ✗ | Scheduled report. Templated structure, only numbers change. |
| Guest proactive check-in (timed) (NEW — 03) | ✗ | T+4-6h "settling in" + T+24h "first morning" auto-messages |
| Section 21 / legal notice generation (NEW — 03) | ✗ | Date-computed, rule-enforced. Minimum statutory periods. |
| Council tenant onboarding (NEW — 03) | ✗ | Different rules than private tenant. Tenant type matters. |
| Post-stay review monitoring (NEW — 03) | ✗ | Watch for review, flag if low rating for Tutu's response |
| Training video ingestion (NEW — 04) | ✗ | AI extracts workflows, templates, rules, tone from videos. Post-MVP. |
| Tacit knowledge fields on contacts/properties (NEW — 04) | ✗ | Free-text notes, surfaced contextually in UI. MVP. |

## Engine gaps

| Gap | Source | Priority |
|-----|--------|----------|
| No landlord branching in maintenance template | 01-roles | High — common case for R2R |
| No cron/scheduled trigger (monthly payouts) | 01-roles | Medium — may not even be a "ticket" |
| No AI message parsing (inbound WhatsApp → data update) | 01-roles (reactive comms) | Critical — blocks real use |
| No outbound message sender (action queue drainer) | All | Critical — actions queue but don't fire |
| No contract/document generation | 01-roles | High — blocks onboarding |
| No group chat message monitoring / intent classification | 02-failure | Critical — Tutu's #1 pain point |
| No payment confirmation gate pattern | 02-failure | Critical — hard state machine requirement |
| No "needs extra details" prompt pattern | 02-failure | Medium — human-in-the-loop for contracts |
| No payout breakdown generator (templated report from data) | 02-failure | Medium — scheduled + templated |
| No email ingestion channel (parallel to WhatsApp) | 03-triggers | Critical — Tutu gets legal/client mail via email |
| No tenant type data model (council vs private) | 03-triggers | High — different onboarding rules |
| No computed data fields / derived fields in data | 03-triggers | High — date calcs must be automatic for legal notices |
| No semantic validation rules beyond type checking | 03-triggers | Medium — "end_date ≥ serve_date + 2 months" kind of rules |

## Infrastructure gaps

| Gap | Notes |
|-----|-------|
| Hosted Supabase | Prototype runs local only |
| Auth | None in prototype |
| UI (any) | Pure SQL + test script so far |
| Deployment (Vercel) | Not set up |
| Twilio webhook (inbound WhatsApp) | Main project has it — can adapt |
| Twilio sender (outbound WhatsApp) | Main project has it — can adapt |

## Product insight

**"Proactive is where VAs have been failing him."** This is the primary value we can deliver immediately. Our engine already supports scheduled auto-actions (via `delay_hours`). We just need the comms layer to actually send them, and the templates to define when they fire.

If Yarro is **reliably proactive** (check-ins always sent, reminders never missed) from day 1, we're already beating his current VAs.

## Reframing after voice note 02

Tutu's failure list is a product roadmap. Every VA failure is a determinism problem — exactly the kind of thing software fixes:
- Not chasing → engine-enforced reminders
- Wrong payout numbers → templated report from data
- Wrong account info → SSOT payment details
- Check-in before payment → state machine gate
- Missed group chat signals → message ingestion + intent classification
- Bad contract details → needs_extra_details human-in-the-loop pattern

The MVP isn't "a dashboard that shows tickets." It's **a system that never fails at the things Tutu's VAs fail at.** If we nail the proactive + the hard gates, Tutu has a system more reliable than any human he's hired.

## After voice note 03 — the pitch crystallises

**"Yarro doesn't drop the ball at month 4."**

Tutu has fired 10 VAs. Every single one followed the same pattern: great for 3 months, then decay. The whole premise of paying a VA £200-£300/month is that they'll be reliable. But they're not.

Every firing trigger Tutu mentioned is something deterministic software prevents:

| Human weakness | Software solution |
|----------------|-------------------|
| Miscounts notice period dates | Computed from input, can't be wrong |
| Misses council email in thread | All channels ingested, AI-classified, never missed |
| Forgets first-night check-in | Scheduled auto-action, always fires on time |
| Drops attention to detail over time | No attention state — consistent forever |
| Doesn't read contract fully | Rule-enforced validation on contract data |
| Has personal stuff affecting work | Not a thing software has |

The pitch is not "smart dashboard." The pitch is **"reliability at a fraction of the cost."**
