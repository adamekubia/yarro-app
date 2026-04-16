# Decisions Log — Workflow Engine v2

## D001: Separate prototype (2026-04-16)
**Decision:** Build engine as separate `prototype/` directory, not modify production.
**Alternatives:** (a) Evolve production incrementally, (c) entirely new repo.
**Rationale:** Clean room for new architecture, but can reference existing migrations. Same git history.

## D002: Local Supabase + Postgres (2026-04-16)
**Decision:** Use local Supabase (Docker) for prototype database.
**Alternatives:** SQLite + Drizzle for lighter iteration.
**Rationale:** Same stack as production. Migration path is seamless. Proves engine in real environment.

## D003: Data-driven state machines over hardcoded sub-routines (2026-04-16)
**Decision:** State machines defined as JSONB data, not SQL functions per workflow type.
**Alternatives:** Continue adding sub-routines to polymorphic router.
**Rationale:** Enables unlimited workflow types without code changes. Configuration, not customisation.

## D004: CLAUDE.md as immune system with docs/ for detail (2026-04-16)
**Decision:** CLAUDE.md ~70 lines (architecture + decision framework + triggers). Detailed guardrails, conventions, and procedures in docs/ files read at session start.
**Alternatives:** Everything in CLAUDE.md (~200 lines). Everything in docs/ (CLAUDE.md just a pointer).
**Rationale:** CLAUDE.md survives context compression. Must contain enough to prevent architectural corruption alone. Details in docs/ reduce per-message cost.

## D005: data_schema is simple allowlist, not JSON Schema (2026-04-16)
**Decision:** Field name → type + required. Validation function checks: no unknown fields, required fields present, types match.
**Alternatives:** Full JSON Schema with `$ref`, `oneOf`, `additionalProperties`.
**Rationale:** JSON Schema is overengineering for this stage. Simple allowlist covers 95% of validation needs.

## D006: is_initial uniqueness enforced by application (2026-04-16)
**Decision:** Exactly one `is_initial = true` per template enforced by seed/creation logic, not DB constraint.
**Alternatives:** Partial unique index `WHERE is_initial = true`.
**Rationale:** Partial unique indexes add complexity for no gain in prototype. Revisit for production.

## D007: No status column on tickets (2026-04-16)
**Decision:** Terminal state (`is_terminal` on workflow_states) + bucket replaces open/closed/archived.
**Alternatives:** Keep a `status` column alongside `current_state`.
**Rationale:** `status` would be a second source of truth. The state machine IS the status.

## D008: One audit table, not three (2026-04-16)
**Decision:** Single `ticket_events` table. No `_audit_log` JSONB on tickets, no legacy ledger.
**Alternatives:** Keep denormalised audit on tickets for quick access.
**Rationale:** SSOT. One place to query events. Denormalised audit is a second source that drifts.

## D009: Unified contacts table with roles array (2026-04-16)
**Decision:** One `contacts` table with `roles text[]`, not separate tables per role.
**Alternatives:** `contractors`, `tenants`, `cleaners`, `landlords` as separate tables.
**Rationale:** A cleaner who is also a handyman is one contact, not two rows. Role-specific validation via application logic.

## D010: Minimal properties table (2026-04-16)
**Decision:** Only id, name, address, property_type, metadata for prototype.
**Alternatives:** Full production properties table with contractor mapping, approval limits, etc.
**Rationale:** Configuration fields added when we build the configuration layer. Not needed to prove the engine.

## D011: Action queue from day one (2026-04-16)
**Decision:** `action_queue` table exists even though comms layer isn't built.
**Alternatives:** Skip queue, add later when comms is built.
**Rationale:** Clean boundary between engine and comms. Engine writes to queue; comms reads from it. Design proves the separation works.

## D012: Safe mutation over immutability for workflow_states (2026-04-16)
**Decision:** States are editable. Dangerous mutations (delete active, rename active, change bucket) blocked/handled by trigger. No version table.
**Alternatives:** Full immutability with version tracking. Copy-on-write state definitions.
**Rationale:** Version sprawl creates tech debt. Safe mutation keeps the system clean. Trigger-enforced: delete blocked if open tickets, bucket change recomputes on all tickets.

## D013: contacts.property_ids uses uuid array (2026-04-16)
**Decision:** UUID array, not join table. Acceptable for prototype.
**Alternatives:** `contact_properties` join table with proper FKs.
**Rationale:** No property deletion flows in prototype. Production needs the join table. Explicitly acknowledged trade-off.

## D014: after_hours uses _waiting pseudo-field (2026-04-16)
**Decision:** `after_hours` reads `ticket.waiting_since`, not `ticket.data`. Field is always `_waiting`.
**Alternatives:** Read from a data field, allowing arbitrary time comparisons.
**Rationale:** One time-based operator, one source (waiting_since). Calendar logic uses data fields + comparison operators.

## D015: Three action types at launch (2026-04-16)
**Decision:** `send_message`, `notify`, `create_ticket`. `update_data` removed.
**Alternatives:** Four types including `update_data` for engine self-modification.
**Rationale:** State IS the data. No self-modification, no loop risk. Engine is purely reactive.

## D016: create_ticket requires confirmation on manual override (2026-04-16)
**Decision:** `create_ticket` auto-actions from manual overrides queue as `pending_confirmation`.
**Alternatives:** All actions fire immediately regardless of trigger type.
**Rationale:** Manual overrides are human judgement. Cross-workflow side effects should also be under human judgement.

## D017: Per-state SLA on workflow_states (2026-04-16)
**Decision:** `sla_hours` column on `workflow_states`. Each state defines its own SLA.
**Alternatives:** Per-bucket SLA from template config.
**Rationale:** More precise. "handoff_review = 4h" vs "awaiting_contractor = 48h" — same bucket, different urgency.

## D018: Comparison operators are numeric only (2026-04-16)
**Decision:** `gt`/`lt`/`gte`/`lte` cast to numeric. Dates stored as epoch seconds.
**Alternatives:** Type detection for dates.
**Rationale:** Simpler, fewer edge cases. One type for comparisons.

## D019: Timeout fires before transitions + late reply pattern (2026-04-16)
**Decision:** Timeout takes priority. Late data handled by template design: timeout destination states have transitions for late arrivals.
**Alternatives:** Transitions first (forgiving). Configurable per state.
**Rationale:** Surfaces problems. Late replies still captured — just routed through a "late response" state for human review.

## D020: recipient_key for action queue UNIQUE constraint (2026-04-16)
**Decision:** Non-nullable `recipient_key` text column ('role:contractor' or 'contact:uuid'). UNIQUE(transition_id, action_type, recipient_key).
**Alternatives:** UNIQUE on (event_id, action_type). UNIQUE with COALESCE on nullable recipient_id.
**Rationale:** No NULL issues. Catches cross-invocation duplicates (double trigger fire). Airtight.

## D021: Full type checking in validate_ticket_data (2026-04-16)
**Decision:** Validate boolean, number, text, uuid (format check), timestamptz from day one.
**Alternatives:** Skip type checking for prototype, catch at evaluation time.
**Rationale:** Security and reliability are core priorities. Bad data caught at write time, not evaluation time.

## D022: 2 templates for prototype (2026-04-16)
**Decision:** Maintenance (11 states) + Cleaning Turnover (8 states). Guest stay deferred.
**Alternatives:** 1 template only. 3 templates.
**Rationale:** Two structurally different patterns (reactive vs calendar-driven) prove the engine handles variety. Three risks spreading thin.

## D023: Maintenance ported as core + key branches (2026-04-16)
**Decision:** 11 states. Happy path + handoff, declined, no response, late response, booking stale, job not completed. Skip OOH, landlord allocation, reschedule.
**Alternatives:** Full 20-state port. Minimal 6-state happy path only.
**Rationale:** Enough complexity to prove branching. Not so much that we get bogged down.

---

# v2 Production Decisions (D100+)

## D100: yarro-v2/ at repo root (2026-04-16)
**Decision:** New directory `yarro-v2/` at repo root. Not inside prototype. Not a new repo.
**Rationale:** Same git history, isolated build, can reference prototype + main project via `../` paths.

## D101: New cloud Supabase project, separate free org (2026-04-16)
**Decision:** Separate Supabase org + project for v2 (ref: `iyppfdkhbtizeiugvlic`). Not reusing main project's Supabase.
**Rationale:** Zero risk to main project's live data. Zero billing entanglement. Clean room.

## D102: Feature-by-feature iteration, no speculative copying (2026-04-16)
**Decision:** Copy from main project only when a specific feature needs it.
**Rationale:** Discipline. Prevents dragging in old architecture assumptions.

## D103: MVP includes WhatsApp, not shadow tool (2026-04-16)
**Decision:** Full WhatsApp in + out in MVP. 2-3 week timeline accepted.
**Rationale:** Tutu's voice notes revealed proactive messaging is THE primary VA failure. Without it, demo is unconvincing.

## D104: Auth copied from main, simple RLS (2026-04-16)
**Decision:** Email+password with `createBrowserClient`/`createServerClient`. RLS: `authenticated` role has full access.
**Rationale:** Email+password is simplest to test. Single-PM (Tutu) = no tenancy isolation needed yet.

## D105: 4 MVP templates (2026-04-16)
**Decision:** Maintenance (+ landlord), Cleaning Turnover (port), Move-in Coordination (new, showcase hard gate), Guest Proactive Check-in (new, pitch).
**Rationale:** Each demonstrates a distinct value: reactive branching, calendar-driven, hard gates, time-triggered proactive.

## D106: Tacit knowledge as metadata.notes (2026-04-16)
**Decision:** Free-text `notes` fields on contacts/properties.metadata, surfaced in UI contextually.
**Rationale:** Start with dumb text. Structured fields + AI extraction post-MVP.

## D107: WhatsApp only for MVP, email deferred (2026-04-16)
**Decision:** Only WhatsApp channel. Email ingestion in backlog.
**Rationale:** One channel to get right first. Twilio is familiar stack. Email has different infra.

## D108: AI intent classification rule-based first (2026-04-16)
**Decision:** Inbound classification uses rules (keywords, phone → ticket mapping). LLM only where rules fail.
**Rationale:** Rules are deterministic and debuggable. LLMs hallucinate.

## D109: Next.js 16 proxy.ts not middleware.ts (2026-04-16)
**Decision:** Use `src/proxy.ts` (Next.js 16 convention).
**Rationale:** Next.js 16 renamed middleware → proxy.

## D110: yarro-v2/supabase/config.toml required to anchor CLI (2026-04-16)
**Decision:** Minimal config.toml in yarro-v2/supabase/ so Supabase CLI recognises it as its own project.
**Rationale:** Learned the hard way — without a local config.toml, `supabase link` walks up to main's supabase/, overwriting main's linkage and pushing wrong migrations. Caught and recovered.
