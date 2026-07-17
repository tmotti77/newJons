-- Fast Lane initial schema (DEV_PLAN §3.8)
-- One file per change; never edit old migrations (CLAUDE.md).

-- profiles: 1 row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar text not null default 'a1',
  created_at timestamptz not null default now()
);

create type game_status as enum ('lobby','active','finished','abandoned');
create type game_mode as enum ('live','async','solo');

create table games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 5-char A-Z room code, generated server-side
  status game_status not null default 'lobby',
  mode game_mode not null default 'live',
  host_id uuid not null references profiles(id),
  settings jsonb not null,                -- goal preset, timer length, max weeks, etc. (zod-validated)
  seed bigint not null,                   -- game RNG seed
  current_round int not null default 0,
  winner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table game_players (
  game_id uuid references games(id) on delete cascade,
  player_id uuid references profiles(id),
  slot int not null,                      -- 0..7, stable ordering & RNG lane
  state jsonb not null,                   -- full PlayerState (engine-owned shape)
  is_connected boolean not null default true,
  last_seen timestamptz not null default now(),
  primary key (game_id, player_id),
  unique (game_id, slot)
);

create type round_status as enum ('planning','resolved');

create table rounds (
  game_id uuid references games(id) on delete cascade,
  round_number int not null,
  status round_status not null default 'planning',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  resolved_at timestamptz,
  primary key (game_id, round_number)
);

create table round_plans (
  game_id uuid,
  round_number int,
  player_id uuid references profiles(id),
  plan jsonb not null,                    -- ordered Action[] (zod-validated)
  submitted_at timestamptz not null default now(),
  primary key (game_id, round_number, player_id),
  foreign key (game_id, round_number) references rounds(game_id, round_number) on delete cascade
);

create table round_results (
  game_id uuid,
  round_number int,
  results jsonb not null,                 -- WeekResult: per-player deltas, event cards, standings
  primary key (game_id, round_number),
  foreign key (game_id, round_number) references rounds(game_id, round_number) on delete cascade
);

-- RLS: enabled on everything. Players can select rows only for games they're
-- in; ALL writes go through edge functions (service role). Room-code join
-- looks up by code with service role, so `games` needs no public
-- select-by-code policy.

alter table profiles enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table rounds enable row level security;
alter table round_plans enable row level security;
alter table round_results enable row level security;

create policy "profiles: read own" on profiles
  for select using (auth.uid() = id);

create policy "games: players can read their games" on games
  for select using (
    exists (
      select 1 from game_players gp
      where gp.game_id = games.id and gp.player_id = auth.uid()
    )
  );

create policy "game_players: players can read their game's roster" on game_players
  for select using (
    exists (
      select 1 from game_players gp
      where gp.game_id = game_players.game_id and gp.player_id = auth.uid()
    )
  );

create policy "rounds: players can read their game's rounds" on rounds
  for select using (
    exists (
      select 1 from game_players gp
      where gp.game_id = rounds.game_id and gp.player_id = auth.uid()
    )
  );

create policy "round_plans: players can read their game's plans" on round_plans
  for select using (
    exists (
      select 1 from game_players gp
      where gp.game_id = round_plans.game_id and gp.player_id = auth.uid()
    )
  );

create policy "round_results: players can read their game's results" on round_results
  for select using (
    exists (
      select 1 from game_players gp
      where gp.game_id = round_results.game_id and gp.player_id = auth.uid()
    )
  );

-- No insert/update/delete policies anywhere: all writes go through edge
-- functions running with the service role key, which bypasses RLS.
