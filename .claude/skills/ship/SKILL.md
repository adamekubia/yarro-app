# Ship — Build, Test, Merge, Push

## Purpose

The closing ritual for every build session. Runs the test plan from the active PRD, verifies the build, commits, merges to main, pushes, and logs. Stops on failure.

**Every feature must go through /ship before starting the next one.**

## When To Use

- Build is complete and ready to deploy
- Trigger: `/ship`
- Should be the last thing in every build session

## Process

### Step 1 — Find the Active PRD

Look in `.claude/tasks/` for the most recent file with `Status: In Progress`.

- If found: use it as the reference for this ship.
- If none found: ask Adam "Which task are we shipping?" and proceed with their answer.
- If multiple found: something is wrong (Rule 1 violation). Ask Adam which one to ship and which to abandon.

### Step 2 — Run the Test Plan

Read the Test Plan table from the active PRD. Work through each row:

For each test step:
1. Execute it (run a command, navigate to a page) or ask Adam to verify in browser
2. Record pass or fail
3. If a step **fails**:
   - Ask: "Test [#] failed: [description]. Is this a **blocker** (must fix before shipping) or a **known issue** (ship with this noted)?"
   - If **blocker**: stop shipping. Fix the issue. Then re-run `/ship` from the top.
   - If **known issue**: log it in the PRD under a `### Known Issues` section and continue.

If there is no test plan in the PRD (shouldn't happen with /scope, but just in case):
- Run the acceptance criteria as the test plan instead
- At minimum, verify each acceptance criterion passes

### Step 3 — Test & Build Check

```bash
npm test
npm run build
```

**Both must pass with zero errors/failures.** If either fails:
- Show the error
- Fix it
- Re-run the failing command
- Do NOT proceed until both pass

Tests live in `src/lib/__tests__/` and run via Vitest. If you added or changed any utility function in `src/lib/`, check whether existing tests need updating or new tests should be added.

### Step 4 — Commit

Stage the specific files that were changed. Be explicit — don't use `git add .` or `git add -A`.

```bash
git add [specific files]
git commit -m "[prefix]: [concise description from PRD goal]"
```

Use the conventional prefix from the PRD branch name:
- `feat/` branch → `feat:` commit
- `fix/` branch → `fix:` commit
- `refactor/` branch → `refactor:` commit
- `style/` branch → `style:` commit

If there are already multiple commits on the branch (from Rule 4 mid-session commits), that's fine — they'll all be preserved in the merge.

### Step 5 — Merge to Main

```bash
git checkout main
git pull origin main
git merge --no-ff feat/[name] -m "merge: [PRD name] — [one-line summary]"
```

**Always use `--no-ff`** — this creates a merge commit that can be reverted as a single unit.

If there are **merge conflicts**:
- Show the conflicting files
- Resolve with Adam's input
- Do NOT auto-resolve conflicts without Adam seeing them

### Step 6 — Push

```bash
git push origin main
```

This triggers the Vercel production deployment.

After pushing, note:
> "Pushed to origin/main. Vercel deployment will start automatically. Check `yarro-pm.vercel.app` in a few minutes."

### Step 7 — Close Out

1. **Mark PRD complete**: edit the task file, change `Status: In Progress` → `Status: Complete`

2. **Update SESSION_LOG.md**: add an entry:
```markdown
## YYYY-MM-DD — [PRD name]

### Summary
[One paragraph of what was built]

### Changes Made
- [File]: [what changed]

### Status
- [x] Build passes
- [x] Test plan passes
- [x] Committed and pushed
- [x] Merged to main

### Next Session Pickup
1. [Most important next step]
2. [Anything from the Out of Scope list worth doing next]
```

3. **Backlog capture**: check the PRD's "Out of Scope" section. Add any items to `.claude/tasks/BACKLOG.md` if not already there.

4. **Branch cleanup** (suggest, don't force):
> "Want to delete the feature branch? `git branch -d feat/[name]`"

5. **Done**:
> "Shipped and merged to main. Vercel deploying. What's next, or are we done for the day?"

## Rollback

If something breaks in production after shipping:

```bash
# Revert the merge commit (keeps history clean)
git checkout main
git revert -m 1 HEAD
git push origin main
```

This undoes the merge without force-pushing. The feature branch still exists for debugging.

## Rules

- Never skip the test plan — it exists for a reason
- Never skip `npm test` — automated tests catch regressions the test plan won't
- Never skip the build check
- Always use `--no-ff` for the merge (single revert point)
- Always update SESSION_LOG.md
- Always check for Out of Scope items to backlog
- If the test plan has blockers, fix them before shipping — don't ship broken
