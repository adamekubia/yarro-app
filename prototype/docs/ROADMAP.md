# Roadmap — Workflow Engine v2

Build steps in order. Each step is one session. Do not skip ahead.

## Completed

- [x] **Step 1: Foundation** — CLAUDE.md, docs/ structure, decision framework, guardrails, conventions, session protocol. No code.
- [x] **Step 2: Core schema** — 7 tables, 3 triggers, FKs, CHECK constraints. Migration: `00001_core_schema.sql`. SCHEMA.md written.
- [x] **Step 3: Engine functions** — `evaluate_condition`, `compute_next_action`, `fire_auto_actions`, `trigger_recompute`, `create_ticket`, `manual_override`, `validate_ticket_data`, `protect_workflow_states`. Migration: `00002_engine.sql`. 8 functions, 3 triggers.
- [x] **Step 4: Seed templates + test harness** — Maintenance (11 states) + Cleaning Turnover (8 states). 13 tests (6 scenarios + 7 guardrail checks). Migration: `00003_seed_templates.sql`. Test script: `scripts/test-engine.ts`.

## Next

- [ ] **Step 5: Edge cases + hardening** — Compound conditions (`all_of`/`any_of`) tested end-to-end. Multi-hop transitions (data change triggers chain of states). Concurrent update safety. Timeout + data race scenarios. Error messages reviewed for clarity.
- [ ] **Step 6: Cross-workflow triggers** — `create_ticket` auto-action actually creates child tickets with `parent_ticket_id`. `pending_confirmation` flow for manual overrides. Parent-child event linking.
- [ ] **Step 7: Priority scoring** — `compute_priority(ticket_id)` using `default_config.priority_weights`. Age, timeout proximity, manual boost. Dashboard-ready sort order.
- [ ] **Step 8: Reinforcement audit** — Full guardrail sweep. Grep for template-specific IF statements. SCHEMA.md vs `\d` comparison. Naming convention audit on all states/fields. Operator list frozen. Decision log complete. Prototype declared stable.

## Future (post-prototype)

- [ ] Comms layer (WhatsApp/SMS/email delivery from action_queue)
- [ ] UI layer (dashboard, ticket detail, manual override UI)
- [ ] 3rd template (guest stay or compliance renewal)
- [ ] PM-level workflow configuration overrides
- [ ] Performance (indexes, caching, materialised views)
