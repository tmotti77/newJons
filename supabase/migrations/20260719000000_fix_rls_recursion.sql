-- Fix 42P17 "infinite recursion detected in policy for relation game_players".
--
-- The game_players select policy checked membership by selecting from
-- game_players itself; policy subqueries run as the querying user, so
-- evaluating the policy re-triggered the same policy. Every other table's
-- policy joins through game_players, so ALL direct client reads failed
-- (the reveal screen's round_results read was the first real victim —
-- edge functions use the service role and bypass RLS, which is why the
-- Phase 2 e2e suite never saw it).
--
-- Fix: a security definer helper performs the membership check with RLS
-- bypassed; every read policy delegates to it.

create or replace function public.is_game_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_players
    where game_id = gid and player_id = auth.uid()
  );
$$;

revoke all on function public.is_game_member(uuid) from public;
grant execute on function public.is_game_member(uuid) to authenticated;

drop policy "games: players can read their games" on games;
create policy "games: players can read their games" on games
  for select using (public.is_game_member(id));

drop policy "game_players: players can read their game's roster" on game_players;
create policy "game_players: players can read their game's roster" on game_players
  for select using (public.is_game_member(game_id));

drop policy "rounds: players can read their game's rounds" on rounds;
create policy "rounds: players can read their game's rounds" on rounds
  for select using (public.is_game_member(game_id));

drop policy "round_plans: players can read their game's plans" on round_plans;
create policy "round_plans: players can read their game's plans" on round_plans
  for select using (public.is_game_member(game_id));

drop policy "round_results: players can read their game's results" on round_results;
create policy "round_results: players can read their game's results" on round_results
  for select using (public.is_game_member(game_id));
