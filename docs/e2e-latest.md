# E2E: simulate-live-game

Latest verified results (2026-07-17, runs #3 and #5 of the `E2E (live backend)` workflow
against https://viwjknigxfxwszfvxsrg.supabase.co — outcomes confirmed in the database):

- RLS: direct insert/update with a user JWT denied; cross-game select returns nothing ✓
- Game "all submit" (auto-resolve on 4th submission): finished with a winner in 12 weeks (×2 runs: TMJGW, GGAHN) ✓
- Game "player 3 AFK from week 2" (timer-expiry resolve + two concurrent resolve-round calls every round): finished with a winner in 11 and 13 weeks (GLKNR, AUDZZ) ✓ — no double-resolution ever observed
- Weeks-to-win matches the offline balance sim (Quick p50 = 12)
- Realtime postgres_changes: publication configured via migration; Node-client delivery flaky in CI (non-fatal warn) — authoritative on-device verification scheduled for Phase 3

Report is auto-updated by `.github/workflows/e2e.yml` on backend-affecting pushes.
