-- Rematch (§2.8 "Rematch (new game, same lobby)"): a finished game points to
-- its rematch lobby. First player to tap Play Again creates it (CAS on null),
-- everyone else's /over doorbell sees the games-row update and offers a
-- one-tap join.
alter table games add column rematch_game_id uuid references games(id);
