# Changelog

## 2026-07-17 — Phase 3: Client core gameplay
- Full screen map (§4.1): home w/ return-to-game banner, setup (name+avatar), create (preset/timer), join (code entry), lobby (presence avatars, share sheet, host start), planning screen (§4.2: stats strip, server-clock countdown, tappable town grid, per-location action sheets, plan tray with live TU/cash projections, lock-in), reveal choreography (§4.3: splash → global events → juicy player cards → standings), game over.
- Data layer: typed API client, anonymous auth bootstrap, zustand store with the single hydrateFromSnapshot path, realtime doorbell (postgres_changes + AppState resume + 5s safety poll), timer-expiry resolve calls.
- Design system: dark board-game theme, emoji avatars/buildings, RTL-safe layouts, full en+he i18n (every string keyed).
- Monorepo Metro config; engine runs on-device for instant plan validation.

## 2026-07-17 — Phase 2: Backend
- Single `api` edge function (deployed) routing all §3.9 endpoints; zod-validated, server re-validates plans with the engine; CAS-idempotent resolve (planning→resolving→resolved) with stale-claim recovery; auto-rest fill for missing plans.
- Migrations: `resolving` round status, `games.global_state`, realtime publication, pg_cron sweep (60s) for expired rounds + retention.
- `scripts/simulate-live-game.ts` E2E in CI: 4 real clients over the deployed backend — game 1 (all submit) finished in 12 weeks, game 2 (AFK player from w2, concurrent double resolve-round calls every round) finished in 11 weeks; RLS direct-write denial verified. Note: `dev-create-user` endpoint is test-only, remove before launch.

## 2026-07-17 — Phase 1: Game engine
- Pure deterministic engine: types, balance config, seeded RNG (mulberry32, per-week/per-player lanes), validatePlan, resolveWeek, goals, events, greedy bot.
- 101 tests incl. determinism property (100 games × 10 weeks replayed byte-identical) and fuzz (900 game-weeks, invariants held); engine line coverage 95.9%.
- Balance sim (scripts/balance-sim.ts, 2,000 games/preset): Quick p50=12w (target 10–14 ✓), Classic p50=14w, Marathon p50=23w. Report in docs/balance-sim-report.md. Tuned: quick netWorth 2000→3500.

## 2026-07-17 — Phase 0: Foundations
- pnpm monorepo (apps/mobile, packages/engine, packages/shared, supabase/), TS strict, ESLint+Prettier, Vitest.
- Expo app boots with expo-router; i18n (en/he) + RTL switch.
- Supabase project `fastlane` (viwjknigxfxwszfvxsrg): §3.8 schema + RLS applied.
- GitHub Actions CI (lint, typecheck, tests). CLAUDE.md/AGENTS.md committed.
