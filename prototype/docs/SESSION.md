# Session Procedures — Workflow Engine v2

## Session Start

1. Read `docs/GUARDRAILS.md` — know the rules
2. Read `docs/SCHEMA.md` — know the current tables + current state
3. Read `docs/DECISIONS.md` — know what's been decided
4. Read `docs/ARCHITECTURE.md` — know how the system works
5. Read `docs/ROADMAP.md` — know where we are and what's next
6. Enter plan mode — discuss scope and approach
7. Get Adam's approval — then and only then, write code

## During Session

- **Scope lock:** anything out of scope → BACKLOG.md (under correct layer group), not code
- **Adam proposes adding scope →** push back explicitly: "That's a separate session. Backlogging it. Let's finish [current scope] first."
- **Structural decision made →** DECISIONS.md entry in same commit
- **Migration written →** SCHEMA.md updated in same commit (including "Current State" section)
- **States/fields created →** follow CONVENTIONS.md naming
- **Engine logic or conditions written →** follow CONVENTIONS.md operators, JSONB formats, nesting limits
- **Tests added →** update TESTS.md with new test descriptions

## Session End

### 1. Clean run
```bash
npm run db:reset    # Must complete cleanly
npm test            # All tests must pass — see docs/TESTS.md for expected output
```

### 2. Reinforcement audit
Run through each check:

- [ ] Does SCHEMA.md match the actual database? (`\d tablename` in psql)
- [ ] Is SCHEMA.md "Current State" section accurate? (migration count, template count, test count)
- [ ] Do all new state slugs follow naming convention? (verb_noun or adjective)
- [ ] Do all new data fields follow naming convention? (noun_verb_past)
- [ ] Were any guardrails violated during this session?
- [ ] Is DECISIONS.md up to date with any structural decisions?
- [ ] Is BACKLOG.md updated with any deferred items?
- [ ] Is ROADMAP.md updated with step completion status?
- [ ] Is TESTS.md updated with any new test descriptions?
- [ ] Run the Decision Framework checks from CLAUDE.md against every change:
  - SSOT check: any duplicated truth?
  - Template-agnostic check: any template-specific code in engine?
  - Strongest option check: any shortcuts taken?
  - Simplicity check: any over-complex conditions?
  - SSOT build check: docs in sync with code?

### 3. Commit
Descriptive commit message. Include which step was completed.
