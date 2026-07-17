import { initialPlayerState } from "../../packages/engine/src/index";
import { createGameRequestSchema } from "../../packages/shared/src/index";
import {
  admin, buildSnapshot, caller, fail, generateCode, generateSeed, handleOptions, json
} from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = createGameRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());
  const { displayName, avatar, settings } = body.data;

  await db.from("profiles").upsert({ id: userId, display_name: displayName, avatar });

  // unique room code with retry
  let game: { id: string; code: string } | null = null;
  for (let attempt = 0; attempt < 5 && !game; attempt++) {
    const { data, error } = await db
      .from("games")
      .insert({
        code: generateCode(),
        status: "lobby",
        mode: "live",
        host_id: userId,
        settings,
        seed: generateSeed(),
        current_round: 0
      })
      .select("id, code")
      .single();
    if (!error && data) game = data;
  }
  if (!game) return fail(500, "err.codeCollision");

  await db.from("game_players").insert({
    game_id: game.id,
    player_id: userId,
    slot: 0,
    state: initialPlayerState(0)
  });

  const snapshot = await buildSnapshot(db, game.id, userId);
  return json({ gameId: game.id, code: game.code, snapshot });
}
