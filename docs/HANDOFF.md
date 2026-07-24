# Fast Lane — Session Handoff (2026-07-24)

Read this + `docs/DEV_PLAN.md` (the spec, single source of truth) + `CLAUDE.md` (rules)
before doing anything. `CHANGELOG.md` has the per-phase history.

⚠️ **Two active lines of history — know which one you're on.**
`main` has Phases 0–3 plus the rematch/leave-game backend work (commit `d951fd5`).
`feat/fun-core` branches off `d951fd5` and is significantly ahead: an Expo SDK 51→54
upgrade + the full "Milestone 1: Fun core" redesign (flat-vector planning/reveal
screens, tap-to-travel town, walking character, roast reveal). **`feat/fun-core` is
the branch to build on** — it is a strict superset of `main` (zero commits on `main`
that aren't already in `feat/fun-core`). It is NOT merged to `main` yet and has no
open PR, so GitHub Actions CI (triggers on `pull_request` or push to `main` only)
has never run on it — verify locally (`pnpm typecheck && pnpm lint && pnpm test`)
until a PR exists. Re-verified locally 2026-07-24: typecheck/lint clean, 133/133
tests green (105 engine + 22 new mobile geometry tests + 6 shared).

## Current status: Phases 0–3 CODE COMPLETE; Milestone 1 (fun-core redesign) code complete, pending final on-device sign-off

- **Phase 0** ✓ monorepo (pnpm), Expo app, Supabase schema+RLS, CI.
- **Phase 1** ✓ pure deterministic engine (`packages/engine`), tests + coverage,
  determinism + fuzz suites, balance sim (`pnpm sim`) — Quick preset tuned to p50=12 weeks.
- **Phase 2** ✓ backend live. Single edge function `api` (all §3.9 endpoints as sub-routes,
  now including `rematch-game`), CAS-idempotent resolve, pg_cron sweep every 60s.
  E2E-verified via GitHub Actions (`.github/workflows/e2e.yml`) incl. AFK-player,
  concurrent-double-resolve, and rematch-race chaos cases. See `docs/e2e-latest.md`.
- **Phase 3** ✓ code complete AND verified end-to-end on an Android emulator (2026-07-19):
  full Quick game vs `scripts/join-lobby-bot.ts` against prod — create/lobby/realtime
  join/planning/reveal/game-over, kill+reopen → return-to-game banner → live rejoin,
  rematch flow, leave-game, Hebrew UI. Critical RLS recursion bug found & fixed (see below).
  Real-phone playtest **has since happened** (2026-07-22, on `feat/fun-core` — see next).
- **Milestone 1 "Fun core"** (on `feat/fun-core`, plan in
  `docs/superpowers/plans/2026-07-21-fun-core.md`, spec in `docs/superpowers/specs/`):
  flat-vector redesign of planning + reveal screens, tap-to-travel town map, walking
  character (`src/town/geometry.ts` + `Walker.tsx`), per-location icons, draining
  TimeMeter, roast-line reveal (`packages/engine/src/reveal.ts`, TDD). All 11 plan
  tasks implemented and committed. A 2026-07-22 real-phone playtest found 3 issues
  (character teleported instead of walking, map clipped, icons illegible at small
  size) — all three fixed 2026-07-24 (see CHANGELOG). **Still open — the plan's own
  Task 11 checklist** (`docs/superpowers/plans/2026-07-21-fun-core.md` line ~529):
  confirm the walk/map-fit/icons and Hebrew/RTL on a real phone for the 07-24 fixes
  specifically, then tick DEV_PLAN §6 Phase 4 checkboxes and decide merge/PR for the
  branch (`superpowers:finishing-a-development-branch`).

## Infrastructure

- **Supabase project**: `viwjknigxfxwszfvxsrg` (eu-central-1), URL https://viwjknigxfxwszfvxsrg.supabase.co
  - anon/publishable keys are in `apps/mobile/.env.example` (also hardcoded fallbacks in `src/lib/supabase.ts`)
  - migrations in `supabase/migrations/` are ALREADY APPLIED to the live project
  - pg_cron job `sweep-rounds-every-minute` calls `api/sweep-rounds`
  - ⚠️ Anonymous sign-in must be enabled in dashboard (Auth → Providers) for the app to work
  - ⚠️ `dev-create-user` route (test-user factory for e2e) must be removed/disabled before launch
- **Edge function deploy flow**: handlers live in `supabase/functions-src/*.ts` (TS with pnpm
  workspace imports) → `pnpm exec tsx scripts/bundle-functions.ts` bundles to
  `supabase/functions/api/index.ts` (single minified Deno file) → deploy with
  `supabase functions deploy api` (CLI) or the Supabase MCP. NEVER edit the bundled file.
- **E2E**: pushes touching backend paths trigger `.github/workflows/e2e.yml` (plays 2 full
  games against prod and commits `docs/e2e-latest.md`). Run manually: workflow_dispatch,
  or locally `SUPABASE_ANON_KEY=<anon> pnpm exec tsx scripts/simulate-live-game.ts`.

## Known issues / open items

1. ~~Realtime postgres_changes delivery unverified~~ **RESOLVED 2026-07-19**: root cause
   was RLS policy recursion (42P17) — realtime evaluates RLS per subscriber, so the
   recursive `game_players` policy silently killed all delivery (and broke the reveal
   screen's direct read). Fixed in migration `20260719000000` (security definer
   `is_game_member()`); e2e now receives 66 events. The 5s snapshot poll can likely be
   relaxed after a real-phone confirmation.
2. ~~Reveal screen minimal~~ **RESOLVED on `feat/fun-core`**: choreographed card
   sequence with roast lines (en+he) driven by the tested `pickRevealCards()` picker.
3. ~~No leave-game UI~~ **RESOLVED**: 🚪 button in /play top bar, confirm dialog, i18n.
4. ~~Rematch routes home~~ **RESOLVED**: `rematch-game` edge function (CAS-linked
   lobby via `games.rematch_game_id`), /over offers "Join the rematch!" one-tap.
5. Open decisions in DEV_PLAN §9 (final name, currency display, reveal length...) still open.
6. Emulator quirks (not app bugs, documented for future sessions): Expo Go on the
   API 26 AVD needs launch-then-deep-link (direct cold-start intent races → UIManager
   crash); Metro must be restarted after adding a dependency; `adb` reload intents only
   foreground the task — force-stop first for a true JS reload. Slow/software-rendered
   AVDs can take 30–60s to bundle+boot; don't mistake that for a hang.
7. `feat/fun-core` has no PR/CI run yet (see banner above) — needed before merge to `main`.

## Next steps (in order)

1. **Real-phone confirmation of the 2026-07-24 fun-core fixes** (walk, map fit, icon
   legibility, Hebrew/RTL on the new planning/reveal screens) — Task 11 of
   `docs/superpowers/plans/2026-07-21-fun-core.md`. Use the lobby bot to fill seats:
   `SUPABASE_ANON_KEY=<anon> pnpm exec tsx scripts/join-lobby-bot.ts <CODE>`.
2. Tick DEV_PLAN §6 Phase 4 items that are now true; open a PR for `feat/fun-core` →
   `main` (gets CI running) and decide merge timing
   (`superpowers:finishing-a-development-branch`).
3. Remaining Phase 4 work: sound + haptics, tutorial, empty/error states.
4. **Phase 5**: EAS builds → TestFlight/Play Internal, Sentry+PostHog, closed beta.

## Working agreements (from CLAUDE.md — enforced)

- Engine stays pure: no I/O/Date.now()/Math.random(); all balance numbers ONLY in
  `packages/engine/src/config/balance.ts`; every engine change ships with tests;
  determinism suite must stay green. All UI strings via i18n keys (en+he), test RTL.
  DB changes = new migration file. Server is authoritative; clients only predict.
