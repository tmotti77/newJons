import { initialPlayerState } from "../../packages/engine/src/index";
import { rematchGameRequestSchema } from "../../packages/shared/src/index";
import {
  admin,
  buildSnapshot,
  caller,
  fail,
  generateCode,
  generateSeed,
  handleOptions,
  json
} from "./_common";

/**
 * Rematch (§2.8): any player of a FINISHED game taps Play Again.
 * First caller creates the new lobby (same settings, they host) and CAS-links
 * it via games.rematch_game_id; the games-row update rings every /over
 * client's doorbell. Later callers (and losers of the creation race) are
 * simply joined into the existing rematch lobby.
 */
export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = rematchGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());
  const { gameId } = body.data;

  const { data: oldGame } = await db.from("games").select("*").eq("id", gameId).single();
  if (!oldGame) return fail(404, "err.notFound");
  if (oldGame.status !== "finished") return fail(409, "err.game.notFinished");

  const { data: membership } = await db
    .from("game_players")
    .select("player_id")
    .eq("game_id", gameId)
    .eq("player_id", userId)
    .maybeSingle();
  if (!membership) return fail(403, "err.notInGame");

  const joinExisting = async (rematchId: string): Promise<Response> => {
    const { data: rematch } = await db.from("games").select("*").eq("id", rematchId).single();
    if (!rematch) return fail(404, "err.notFound");
    const { data: players } = await db
      .from("game_players")
      .select("player_id, slot")
      .eq("game_id", rematchId)
      .order("slot");
    const already = players?.some((p) => p.player_id === userId);
    if (!already) {
      if (rematch.status !== "lobby") return fail(409, "err.lobby.closed");
      if ((players?.length ?? 0) >= 8) return fail(409, "err.lobby.full");
      const slot = Math.max(-1, ...(players ?? []).map((p) => p.slot)) + 1;
      const { error } = await db.from("game_players").insert({
        game_id: rematchId,
        player_id: userId,
        slot,
        state: initialPlayerState(slot)
      });
      if (error) return fail(500, "err.internal", error.message);
    }
    const snapshot = await buildSnapshot(db, rematchId, userId);
    return json({ gameId: rematchId, code: rematch.code, snapshot });
  };

  if (oldGame.rematch_game_id) return joinExisting(oldGame.rematch_game_id);

  // Create the rematch lobby (same settings, caller hosts).
  let created: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const { data, error } = await db
      .from("games")
      .insert({
        code: generateCode(),
        status: "lobby",
        mode: oldGame.mode,
        host_id: userId,
        settings: oldGame.settings,
        seed: generateSeed(),
        current_round: 0
      })
      .select("id, code")
      .single();
    if (!error && data) created = data;
  }
  if (!created) return fail(500, "err.codeCollision");

  // CAS-link: only one rematch per game. Losing the race → discard ours, join theirs.
  const { data: linked } = await db
    .from("games")
    .update({ rematch_game_id: created.id })
    .eq("id", gameId)
    .is("rematch_game_id", null)
    .select("id");
  if (!linked || linked.length === 0) {
    await db.from("games").delete().eq("id", created.id);
    const { data: refreshed } = await db
      .from("games")
      .select("rematch_game_id")
      .eq("id", gameId)
      .single();
    if (!refreshed?.rematch_game_id) return fail(500, "err.internal", "rematch link race");
    return joinExisting(refreshed.rematch_game_id);
  }

  await db.from("game_players").insert({
    game_id: created.id,
    player_id: userId,
    slot: 0,
    state: initialPlayerState(0)
  });

  const snapshot = await buildSnapshot(db, created.id, userId);
  return json({ gameId: created.id, code: created.code, snapshot });
}
