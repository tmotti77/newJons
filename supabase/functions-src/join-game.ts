import { initialPlayerState } from "../../packages/engine/src/index";
import { joinGameRequestSchema } from "../../packages/shared/src/index";
import { admin, buildSnapshot, caller, fail, handleOptions, json } from "./_common";


const MAX_PLAYERS = 8;

export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = joinGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());
  const { code, displayName, avatar } = body.data;

  const { data: game } = await db.from("games").select("*").eq("code", code).maybeSingle();
  if (!game) return fail(404, "err.game.notFound");
  if (game.status !== "lobby") return fail(409, "err.game.alreadyStarted");

  const { data: players } = await db
    .from("game_players")
    .select("player_id, slot")
    .eq("game_id", game.id)
    .order("slot");

  const existing = players?.find((p) => p.player_id === userId);
  await db.from("profiles").upsert({ id: userId, display_name: displayName, avatar });

  if (!existing) {
    if ((players?.length ?? 0) >= MAX_PLAYERS) return fail(409, "err.game.full");
    const usedSlots = new Set((players ?? []).map((p) => p.slot));
    let slot = 0;
    while (usedSlots.has(slot)) slot++;
    const { error } = await db.from("game_players").insert({
      game_id: game.id,
      player_id: userId,
      slot,
      state: initialPlayerState(slot)
    });
    if (error) return fail(500, "err.join.failed", error.message);
  }

  const snapshot = await buildSnapshot(db, game.id, userId);
  return json({ gameId: game.id, snapshot });
}
