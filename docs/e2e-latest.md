# E2E: simulate-live-game

Run: 2026-07-20T13:31:25.284Z against https://viwjknigxfxwszfvxsrg.supabase.co

- RLS: direct insert/update denied, cross-game select empty ✓
- Game 1 (all submit): finished in 13 weeks ✓
- Direct client read of round_results (reveal path): ✓
- Game 2 (P3 AFK from w2, timer-expiry resolve + double-resolve calls): finished in 12 weeks ✓
- Rematch: concurrent Play Again converges to one lobby; 3rd player joins ✓
- Realtime: 75 postgres_changes events received ✓
