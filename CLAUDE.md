# Fast Lane — Agent Guide

- Monorepo: pnpm. Run `pnpm i`, `pnpm test`, `pnpm typecheck` before finishing any task.
- `packages/engine` is PURE TypeScript: no I/O, no `Date.now()`, no `Math.random()` (use `rng.ts`), no imports from `apps/` or `supabase/`. If a task needs the engine to know about the network, the task is wrong — stop and flag it.
- All user-facing strings go through i18n keys (he+en). Never hardcode. Test RTL.
- All tunable game numbers live in `packages/engine/src/config/balance.ts` only.
- Server is authoritative: clients never write game state directly; all writes via `supabase/functions`.
- Every new engine behavior ships with unit tests; determinism suite must stay green.
- DB changes = new migration file, never edit old migrations.
- Small PRs: one task from `docs/DEV_PLAN.md` per branch. Reference the task checkbox.
- Definition of done: acceptance criteria of the task met + CI green + DEV_PLAN checkbox ticked.

See `docs/DEV_PLAN.md` for the full spec (single source of truth — update it as decisions change).
See `docs/HANDOFF.md` for current project status, live infrastructure details, and next steps.
