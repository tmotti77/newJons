# E2E: simulate-live-game

Run: 2026-07-19T14:53:21.516Z against https://viwjknigxfxwszfvxsrg.supabase.co

- RLS: direct insert/update denied, cross-game select empty ✓
- Game 1 (all submit): finished in 11 weeks ✓
- Direct client read of round_results (reveal path): ✓
- Game 2 (P3 AFK from w2, timer-expiry resolve + double-resolve calls): finished in 11 weeks ✓
- Realtime: 66 postgres_changes events received ✓
