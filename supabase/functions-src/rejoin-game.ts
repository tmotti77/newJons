import { rejoinGameRequestSchema } from "../../packages/shared/src/index";
import { admin, buildSnapshot, caller, fail, handleOptions, json } from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = rejoinGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());

  const snapshot = await buildSnapshot(db, body.data.gameId, userId);
  if (!snapshot) return fail(404, "err.game.notFound");
  if (!snapshot.players.some((p) => p.playerId === userId)) return fail(403, "err.notInGame");

  await db
    .from("game_players")
    .update({ is_connected: true, last_seen: new Date().toISOString() })
    .eq("game_id", body.data.gameId)
    .eq("player_id", userId);

  return json({ snapshot });
}
