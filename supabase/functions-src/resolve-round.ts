import { resolveRoundRequestSchema } from "../../packages/shared/src/index";
import { admin, caller, fail, handleOptions, json, resolveRoundCore } from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();
  const userId = await caller(req, db);
  if (!userId) return fail(401, "err.auth");

  const body = resolveRoundRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail(400, "err.badRequest", body.error.flatten());

  // Any client may call this when it observes ends_at passed (§3.4b);
  // resolveRoundCore is idempotent so N concurrent calls are safe.
  const outcome = await resolveRoundCore(db, body.data.gameId, body.data.roundNumber);
  return json(outcome);
}
