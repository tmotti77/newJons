import { CRYPTO, initialPlayerState } from "../../packages/engine/src/index";
import { startGameRequestSchema } from "../../packages/shared/src/index";
import {
  admin, buildSnapshot, caller, fail, handleOptions, json, loadGame
} from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = startGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());

  const loaded = await loadGame(db, body.data.gameId);
  if (!loaded) return fail(404, "err.game.notFound");
  const { game, players } = loaded;
  if (game.host_id !== userId) return fail(403, "err.notHost");
  if (game.status !== "lobby") return fail(409, "err.game.alreadyStarted");
  if (players.length < 2) return fail(409, "err.game.needTwoPlayers");

  // Compact slots 0..n-1 in join order and re-init states from balance config.
  const sorted = [...players].sort((a, b) => a.slot - b.slot);
  for (let i = 0; i < sorted.length; i++) {
    await db
      .from("game_players")
      .update({ slot: -(i + 1) }) // two-phase to dodge unique(game_id, slot)
      .eq("game_id", game.id)
      .eq("player_id", sorted[i]!.player_id);
  }
  for (let i = 0; i < sorted.length; i++) {
    await db
      .from("game_players")
      .update({ slot: i, state: initialPlayerState(i) })
      .eq("game_id", game.id)
      .eq("player_id", sorted[i]!.player_id);
  }

  const timer = game.settings.planTimerSeconds ?? 90;
  await db.from("rounds").insert({
    game_id: game.id,
    round_number: 1,
    status: "planning",
    ends_at: new Date(Date.now() + timer * 1000).toISOString()
  });
  await db
    .from("games")
    .update({
      status: "active",
      current_round: 1,
      global_state: { week: 1, rentMultiplier: 1, cryptoPrice: CRYPTO.startPrice }
    })
    .eq("id", game.id);

  const snapshot = await buildSnapshot(db, game.id, userId);
  return json({ snapshot });
}
