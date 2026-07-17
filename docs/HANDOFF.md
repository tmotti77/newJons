# Fast Lane — Session Handoff (2026-07-17)

Read this + `docs/DEV_PLAN.md` (the spec, single source of truth) + `CLAUDE.md` (rules)
before doing anything. `CHANGELOG.md` has the per-phase history.

## Current status: Phases 0–3 CODE COMPLETE

- **Phase 0** ✓ monorepo (pnpm), Expo app, Supabase schema+RLS, CI.
- **Phase 1** ✓ pure deterministic engine (`packages/engine`), 101 tests, 95.9% coverage,
  determinism + fuzz suites, balance sim (`pnpm sim`) — Quick preset tuned to p50=12 weeks.
- **Phase 2** ✓ backend live. Single edge function `api` (all §3.9 endpoints as sub-routes),
  CAS-idempotent resolve, pg_cron sweep every 60s. E2E-verified: 4 real full games played by
  4 authenticated clients via GitHub Actions (`.github/workflows/e2e.yml`), incl. AFK-player
  and concurrent-double-resolve chaos cases. See `docs/e2e-latest.md`.
- **Phase 3** ✓ code complete, NOT yet tested on a real phone. All screens, realtime doorbell,
  reconnection, full en+he i18n, dark design system. **First task: real-device playtest.**

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

1. Realtime postgres_changes delivery unverified end-to-end (Node CI client was flaky; the
   app also has a 5s snapshot poll as backstop). Verify on-device, then consider removing poll.
2. Reveal screen is functional but minimal — Phase 4 makes it juicy (animations, sound, roast lines).
3. `leave-game` during active play marks disconnected only; no UI button for it yet in /play.
4. Rematch (§4.1 /over) currently routes home instead of auto-creating a new lobby.
5. Open decisions in DEV_PLAN §9 (final name, currency display, reveal length...) still open.

## Next steps (in order)

1. **Playtest on 2+ real phones** (Expo Go): full Quick game; kill+reopen app mid-round;
   airplane mode during planning. Fix what breaks. That's the Phase 3 acceptance gate.
2. **Phase 4**: art/animations/sound/tutorial/polish + human Hebrew pass (see DEV_PLAN §6).
3. **Phase 5**: EAS builds → TestFlight/Play Internal, Sentry+PostHog, closed beta.

## Working agreements (from CLAUDE.md — enforced)

- Engine stays pure: no I/O/Date.now()/Math.random(); all balance numbers ONLY in
  `packages/engine/src/config/balance.ts`; every engine change ships with tests;
  determinism suite must stay green. All UI strings via i18n keys (en+he), test RTL.
  DB changes = new migration file. Server is authoritative; clients only predict.
