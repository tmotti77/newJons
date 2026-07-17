import { leaveGameRequestSchema } from "../../packages/shared/src/index";
import { admin, caller, fail, handleOptions, json, loadGame } from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = leaveGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());
  const { gameId, playerId } = body.data;

  const loaded = await loadGame(db, gameId);
  if (!loaded) return fail(404, "err.game.notFound");
  const { game, players } = loaded;

  // Kick: host removes someone else (lobby only).
  const target = playerId && playerId !== userId ? playerId : userId;
  if (target !== userId && game.host_id !== userId) return fail(403, "err.notHost");
  if (target !== userId && game.status !== "lobby") return fail(409, "err.kick.lobbyOnly");
  if (!players.some((p) => p.player_id === target)) return fail(404, "err.notInGame");

  if (game.status === "lobby") {
    await db.from("game_players").delete().eq("game_id", gameId).eq("player_id", target);
    const remaining = players.filter((p) => p.player_id !== target);
    if (remaining.length === 0) {
      await db.from("games").update({ status: "abandoned" }).eq("id", gameId);
    } else if (game.host_id === target) {
      // host migration: earliest slot becomes host (§3.9)
      const next = remaining.sort((a, b) => a.slot - b.slot)[0]!;
      await db.from("games").update({ host_id: next.player_id }).eq("id", gameId);
    }
  } else {
    // Active game: never blocks — mark disconnected, auto-rest covers them.
    await db
      .from("game_players")
      .update({ is_connected: false })
      .eq("game_id", gameId)
      .eq("player_id", target);
  }

  return json({ ok: true });
}
