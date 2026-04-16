# Session Procedures — Yarro v2

## Session Start

1. Read `CLAUDE.md` (primary instructions)
2. Read `docs/GUARDRAILS.md`
3. Read `docs/SCHEMA.md`
4. Read `docs/DECISIONS.md` (D001-D023 from prototype + D100+ for v2)
5. Read current sprint in `../../.claude/plans/structured-hatching-wreath.md`
6. Scan `docs/tutu-discovery/gaps-analysis.md` for relevant workflow context
7. Enter plan mode if building new feature — discuss scope with Adam
8. Get approval, then write code

## During Session

- **Scope lock:** anything out of scope → `BACKLOG.md`, not code
- **Adam proposes scope expansion →** push back explicitly
- **Structural decision →** log in `DECISIONS.md` with rationale
- **Migration written →** update `SCHEMA.md` in same commit
- **New component →** check if one exists in `../src/components/` first
- **Tutu insight revealed →** add to `tutu-discovery/` files

## Session End

### 1. Build + test
```bash
npm run build         # Must succeed
# If migrations changed: push to Supabase, test manually
```

### 2. Reinforcement audit
- [ ] SCHEMA.md matches database (if schema changed)
- [ ] Naming conventions followed (state slugs, data fields, template slugs)
- [ ] No template-specific IF statements in engine
- [ ] No duplicated truth (SSOT check)
- [ ] Decision Framework applied to every significant change
- [ ] DECISIONS.md updated if structural decision made
- [ ] BACKLOG.md updated if out-of-scope items noticed

### 3. Commit
Clear message. Reference sprint + day if possible.
