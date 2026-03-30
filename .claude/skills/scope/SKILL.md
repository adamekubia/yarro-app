# Scope — PRD Builder

## Purpose

Build a bounded, testable PRD before any code gets written. This skill interrogates the idea until the scope is clear, generates a structured task file with acceptance criteria and test plan, and creates a branch from main.

**This replaces the morning-prd skill.** The key difference: morning-prd was a form-filler. /scope is an interrogator.

## When To Use

- Adam says "let's build a PRD" or "let's scope this out"
- Start of any build session
- Before any feature, fix, or refactor work begins
- Trigger: `/scope` or `/scope [topic]`

## Process

### Phase 1 — Read Context (silent)

Before asking anything, read:
- `CLAUDE.md` (project rules, session discipline)
- `SESSION_LOG.md` (what was last worked on, next pickup)
- `.claude/tasks/BACKLOG.md` (captured ideas)
- Check `.claude/tasks/` for any files with `Status: In Progress`

**If an incomplete PRD exists**, stop and flag it immediately:
> "There's an unfinished task: **[name]** from [date]. We need to either ship it (`/ship`) or mark it abandoned before starting new work. Which one?"

Do NOT proceed past this point until the incomplete PRD is resolved.

### Phase 2 — Interrogate

Ask these questions **one at a time**. Wait for each answer before asking the next. Do not generate the PRD until all 5 are answered.

**1. "What are we building?"**
Get the feature name and a one-sentence description. If the answer is vague ("improve the dashboard"), push back: "Can you be more specific? What exactly will be different when this is done?"

**2. "Why now? What does this unblock?"**
Forces prioritisation thinking. If there's no clear urgency, note it — this might belong on the backlog.

**3. "What does done look like? How will you test it?"**
This becomes the acceptance criteria. Push for concrete, verifiable statements: "I can click X and see Y" not "the page looks better."

**4. "What are we NOT building?"**
This is the most important question. It creates the scope boundary that prevents creep. If Adam can't answer it, the scope isn't clear enough. Prompt with adjacent features: "Are we also doing [related thing]? Or is that separate?"

**5. "Does this touch any caution zones?"**
Cross-reference against:
- CLAUDE.md caution zones table
- `supabase/core-rpcs/README.md` (protected RPCs)
- Any files in `src/lib/supabase/`, `src/contexts/pm-context.tsx`, `src/proxy.ts`

If it touches a caution zone, note the constraint explicitly.

### Scope Check

After all 5 questions, assess the scope:
- **Touches more than 2-3 areas of the codebase?** Push back: "This touches [areas]. Can we narrow to [one area] and backlog the rest?"
- **Can't be done in one session?** Push back: "This sounds like a multi-session build. Can we slice off the first deliverable piece?"
- **Vague acceptance criteria?** Push back: "I still can't write a test for 'done.' What's the specific thing you'd check in the browser?"

Only proceed to Phase 3 when the scope is clearly bounded.

### Phase 3 — Generate the PRD

Create a file at `.claude/tasks/YYYY-MM-DD-[name].md` using the structure below.

```markdown
## PRD: [name]
**Date:** YYYY-MM-DD
**Branch:** feat/[name] (or fix/ or refactor/)
**Status:** In Progress
**Scope:** [one sentence — this is the "bumper" for drift detection during the session]

### Goal
What this builds and why it matters. One paragraph max.

### User Story
As a [PM/landlord/tenant], I want [action] so that [outcome].

### Technical Plan
[Claude states this — Adam approves before any code is written]
1. Step one
2. Step two
3. Step three

### Acceptance Criteria
- [ ] Specific, testable statement ("User can click X and see Y")
- [ ] Another testable statement
- [ ] Each must be verifiable in browser or via database query

### Test Plan
Step-by-step instructions for verifying the feature works after building.
| # | Step | Expected Result | Pass? |
|---|------|-----------------|-------|
| 1 | [specific action to take] | [what you should see] | |
| 2 | [next action] | [expected result] | |
| 3 | npm run build | Zero errors | |

### Out of Scope
- [Thing that came up but is NOT part of this build]
- [Another adjacent thing]
These items get added to BACKLOG.md if not already there.

### Constraints
- Files not to touch
- Patterns to follow (reference .claude/docs/patterns.md)
- Protected RPCs (reference supabase/core-rpcs/README.md)

### Done When
- [ ] All acceptance criteria pass
- [ ] Test plan passes
- [ ] `npm run build` passes
- [ ] Committed, merged to main, pushed
- [ ] SESSION_LOG.md updated
```

### Phase 4 — Set Up the Session

1. Create the branch from main:
```bash
git checkout main
git pull origin main
git checkout -b feat/[name]  # or fix/[name] or refactor/[name]
```

2. Confirm ready:
> "PRD created at `.claude/tasks/YYYY-MM-DD-[name].md`. Branch `feat/[name]` created from main. Ready to build — confirm to start."

3. **Do NOT write any code until Adam confirms.**

## Lightweight Mode

If Adam describes something obviously small (1-2 files, clear fix, prefix "fix:"), offer:

> "This looks like a quick fix. Full PRD or just branch + done-when?"

If lightweight, create a minimal task file:
```markdown
## Fix: [name]
**Date:** YYYY-MM-DD
**Branch:** fix/[name]
**Status:** In Progress

### Goal
[One sentence]

### Done When
- [ ] [The fix works]
- [ ] `npm run build` passes
- [ ] Committed, merged to main, pushed
```

Then create the branch and confirm. Skip the interrogation.

## Rules

- Never generate a PRD without asking all 5 questions (unless lightweight mode)
- Never branch from an integration branch — always from `main`
- Never start building without Adam's confirmation
- If a previous PRD is in progress, resolve it first
- Add "Out of Scope" items to BACKLOG.md immediately after PRD generation
