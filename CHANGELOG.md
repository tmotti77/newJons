# Changelog

## 2026-07-24 — Fun core polish: walking character, map fit, legible icons

Addresses the three issues from the 2026-07-22 device playtest.

- **The character walks.** Tapping a building now walks the player there along
  the road before the action sheet opens, so a trip reads as a trip and a long
  one visibly costs more than a short one (matching its Time-Unit cost). New pure
  module `apps/mobile/src/town/geometry.ts` owns all map geometry and computes
  paths along a ring (the road centreline offset outward); `Walker.tsx` animates
  one native-driver `Animated.Value` over a 24-point resampled polyline — no
  Reanimated, so the Expo Go / SDK 54 path is untouched. Mid-walk taps rush the
  in-flight leg at 3× and re-target. Spec:
  `docs/superpowers/specs/2026-07-24-walking-character-design.md`.
- **Map fits the screen.** Road narrowed and building columns pulled inward
  (x=60 / x=300) so the name pills stop clipping at the card edges; canvas
  shortened (560→500) and buildings trimmed (58→54) so the map sits under the
  status panel without dominating.
- **Icons read at small size.** Redrawn high-contrast cream-on-tile instead of
  tone-on-tone, low-detail, with the busiest marks (bank, The Spot, phone,
  briefcase) simplified — no more mush at ~36px.
- **CI now sees client code.** `apps/mobile` had no test script and root `test`
  filtered to `./packages/*`; added vitest to the app and widened root `test`.
  22 pure-geometry tests now run in CI (133 total, up from 111). Engine
  untouched; determinism suite still green. Gates: lint + typecheck + test green,
  `expo export` bundles (3.65 MB Hermes).
- **Verified:** full 12-week Quick game played to a decisive finish against the
  lobby bot (weeks 1–12 clean), landing exactly on the Quick p50=12 target.
  **Pending (physical-only):** confirm the walk, map fit, and icons on a real
  phone, plus Hebrew/RTL on the planning screen.

## 2026-07-22 — Milestone 1: Fun core (flat-vector redesign + roast reveal)

- **Planning screen** rebuilt as a tap-to-travel town (spec §4.2): flat-vector
  `TownMap` with a loop road, player character, and dashed planned route; 11
  distinct hand-drawn `LocationIcon` marks; `Building` cards with per-place
  brand colours; the week **time budget** surfaced as a draining `TimeMeter`;
  reskinned action sheets and route plan tray. Emits the same `Action[]` the
  server already validates — no backend or engine-core change.
- **Reveal comedy**, made testable and funnier:
  - New pure engine module `pickRevealCards` (`packages/engine/src/reveal.ts`)
    scans a resolved week's ledger + event cards and selects the juiciest
    moments — capped at `REVEAL.maxCards`, globals first, one roast per player.
    Thresholds live in `balance.ts` (`REVEAL`). 4 new unit tests; determinism
    suite stays green (engine 105 + shared 6 = 111 total).
  - `reveal.tsx` now renders from the picker instead of inline heuristics; the
    picker's parameter is narrowed to a `RevealInput` so the persisted
    `round_results` row feeds in with no cast.
  - Rewrote the four roast lines + event drama copy (en + he) in a deadpan,
    Jones-flavoured voice; keys/params verified identical across locales.
- Gates: `pnpm test` green, mobile `tsc --noEmit` clean, `expo export` bundles
  (3.63 MB Hermes). **Pending (physical-only):** on-device Quick game to
  confirm the town reads as navigation, the time squeeze bites, and a reveal
  card lands a laugh — plus Hebrew/RTL on both new screens.

## 2026-07-19 — Phase 3 verification on Android emulator + critical RLS fix

- Fixed 42P17 RLS policy recursion (`game_players` policy referenced itself; every
  policy joined through it) with a `security definer` `is_game_member()` — migration
  `20260719000000`, applied to live. This single bug broke BOTH the reveal screen
  (only direct PostgREST read in the app) AND realtime `postgres_changes` delivery
  (RLS is evaluated per subscriber): e2e realtime events went 0 → 66 after the fix.
- Metro/pnpm fixes so the app actually boots in Expo Go: `@babel/runtime@^7` direct
  dep (pnpm doesn't hoist Babel's injected helper imports), `expo-linking` pinned to
  the SDK 51 line via pnpm override (open range resolved to a version whose native
  module isn't in Expo Go 51 → crash on launch).
- i18n: `intl-pluralrules` polyfill (Hermes has no `Intl.PluralRules`; Hebrew plural
  categories were silently broken). The Spot emoji 🪩→🎉 (tofu on older Android).
- reveal.tsx: bounded retry + bail-out instead of silently swallowing read errors.
- New `scripts/join-lobby-bot.ts` — joins a lobby by code and auto-plays; opponent
  filler for real-device playtests. E2E sim now also asserts the reveal-path direct
  read (regression guard for RLS bugs service-role reads can't catch).
- Verified on emulator (Expo Go, Android 8): full Quick game vs bot against prod —
  home → setup → create → lobby (realtime join) → planning (action sheets, plan
  tray, timer expiry) → reveal (event cards, standings) → game over; kill+reopen →
  return-to-game banner → rejoin into live reveal; Hebrew UI renders. Still pending
  (physical-only): 2+ real phones, airplane-mode mid-round, RTL mirroring reload.

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
