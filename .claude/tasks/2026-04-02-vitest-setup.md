## Fix: Vitest Test Framework Setup
**Date:** 2026-04-02  |  **Branch:** feat/vitest-setup  |  **Status:** Complete
**Linear:** YAR-38

### Goal
Install Vitest and configure it for the Next.js/TypeScript codebase so we have a working `npm test` command and CI integration.

### Done When
- [x] Vitest installed and configured (`vitest.config.ts`)
- [x] `npm test` script works
- [x] 52 tests for `normalize.ts` pass
- [x] CI pipeline (`.github/workflows/ci.yml`) runs tests on PRs
- [x] `npm run build` passes
- [x] Committed, merged to main, pushed

### Out of Scope
- Writing comprehensive test coverage
- Testing RPCs or components (just utility functions for now)
- Mocking Supabase or API calls

### Notes
- Running on a git worktree to avoid conflicts with main-branch bug fix / dashboard work
- Pure infra — no UI files touched
