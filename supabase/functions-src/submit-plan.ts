import { validatePlan, type Action } from "../../packages/engine/src/index";
import { submitPlanRequestSchema } from "../../packages/shared/src/index";
import {
  admin, buildEngineState, caller, fail, handleOptions, json, loadGame, resolveRoundCore
} from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = submitPlanRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());
  const { gameId, roundNumber, plan } = body.data;

  const loaded = await loadGame(db, gameId);
  if (!loaded) return fail(404, "err.game.notFound");
  const { game, players } = loaded;
  if (game.status !== "active") return fail(409, "err.game.notActive");
  if (game.current_round !== roundNumber) return fail(409, "err.round.stale");

  const me = players.find((p) => p.player_id === userId);
  if (!me) return fail(403, "err.notInGame");

  const { data: round } = await db
    .from("rounds")
    .select("status, ends_at")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber)
    .single();
  if (!round || round.status !== "planning") return fail(409, "err.round.locked");

  // Server-side authority: re-validate with the engine (§5.4).
  const engineState = buildEngineState(game, players);
  const validation = validatePlan(engineState, me.slot, plan as Action[]);
  if (!validation.ok) return fail(422, "err.plan.invalid", validation.errors);

  const { error } = await db.from("round_plans").upsert({
    game_id: gameId,
    round_number: roundNumber,
    player_id: userId,
    plan,
    submitted_at: new Date().toISOString()
  });
  if (error) return fail(500, "err.submit.failed", error.message);

  // All submitted → resolve immediately (§3.4a).
  const { count } = await db
    .from("round_plans")
    .select("player_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("round_number", roundNumber);
  let resolved = false;
  if ((count ?? 0) >= players.length) {
    const outcome = await resolveRoundCore(db, gameId, roundNumber);
    resolved = outcome.status === "resolved";
  }

  return json({ ok: true, submitted: count ?? 0, players: players.length, resolved });
}
