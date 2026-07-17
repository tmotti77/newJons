-- Evolving world state (week, rentMultiplier, cryptoPrice) lives on the
-- game row; per-player state stays in game_players.state.
alter table games add column if not exists global_state jsonb;

-- track when a round entered 'resolving' so the sweep can reset stale claims
alter table rounds add column if not exists resolving_since timestamptz;

-- Realtime: clients subscribe to postgres_changes on these tables (§3.5).
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table game_players;
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table round_results;
