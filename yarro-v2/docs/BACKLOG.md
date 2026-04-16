# Backlog — Yarro v2

Deferred work from voice notes and sprint planning. Not prioritised. Revisit after Sprint 3.

## From Tutu voice notes

### Workflow templates (revealed, not MVP)
- Section 21 / legal notice generation with computed dates (from 03-triggers)
- Council tenant onboarding — different rent/deposit rules (from 03-triggers)
- Contract generation + signature tracking (from 01-roles, 02-failure)
- Tenant onboarding info collection forms (from 01-roles)
- Property onboarding (new landlord contract) (from 01-roles)
- Monthly payout breakdowns — scheduled templated reports (from 01-roles, 02-failure)
- Post-stay review monitoring — watch for reviews, flag low ones (from 03-triggers)
- Guest reactive auto-answer for FAQs (wifi, directions) (from 01-roles)

### Infrastructure (revealed, not MVP)
- Email channel ingestion — parity with WhatsApp (from 03-triggers)
- Group chat multi-party message ingestion (from 02-failure)
- Training video ingestion → AI template generation (from 04-knowledge)
- AI extraction of tone/preferences from existing content (from 04-knowledge)

### Engine features (revealed, not MVP)
- Computed data fields / rule-enforced derivations (Section 21 dates) (from 03-triggers)
- Semantic validation beyond type checks ("end_date ≥ serve_date + 2 months") (from 03-triggers)
- "Needs extra details" human-in-the-loop prompt pattern (from 02-failure)
- Payment confirmation gate pattern (in MVP now, but needs review)

## From prototype deferrals

- OOH dispatch states (maintenance)
- Reschedule flow states (maintenance)
- Date type detection for comparison operators (currently numeric only)
- `contact_properties` join table (currently uuid array)
- Full multi-tenant RLS policies
- PM-level workflow configuration overrides

## From main project (for future migration)

- c1_tickets data migration into v2 tickets
- c1_compliance_certificates → v2 workflow
- c1_rent_ledger → v2 financial workflow
- Existing tenant/contractor/landlord data into v2 contacts table
