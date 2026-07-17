/**
 * Safety net (§3.4c) + retention (§3.8): resolves expired rounds when every
 * client backgrounded the app, and cleans up stale games. Idempotent and
 * harmless to call repeatedly — intended for a 60s cron, also callable by
 * any client with the anon key.
 */
import { admin, handleOptions, json, resolveRoundCore } from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const db = admin();

  // 1. Resolve expired planning rounds of active games.
  const { data: expired } = await db
    .from("rounds")
    .select("game_id, round_number, games!inner(status)")
    .eq("status", "planning")
    .eq("games.status", "active")
    .lte("ends_at", new Date().toISOString())
    .limit(50);
  const resolved: string[] = [];
  for (const r of expired ?? []) {
    const outcome = await resolveRoundCore(db, r.game_id, r.round_number);
    if (outcome.status === "resolved") resolved.push(`${r.game_id}#${r.round_number}`);
  }

  // 2. Retention: abandon stale lobbies (>2h) and idle active games (>24h).
  const twoHoursAgo = new Date(Date.now() - 2 * 3600e3).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString();
  await db.from("games").update({ status: "abandoned" })
    .eq("status", "lobby").lt("created_at", twoHoursAgo);
  const { data: idleActive } = await db
    .from("rounds")
    .select("game_id, games!inner(status)")
    .eq("games.status", "active")
    .eq("status", "planning")
    .lt("ends_at", dayAgo)
    .limit(50);
  for (const r of idleActive ?? []) {
    await db.from("games").update({ status: "abandoned" }).eq("id", r.game_id);
  }

  // 3. Hard-delete finished/abandoned games older than 30 days.
  const monthAgo = new Date(Date.now() - 30 * 86400e3).toISOString();
  await db.from("games").delete()
    .in("status", ["finished", "abandoned"]).lt("created_at", monthAgo);

  return json({ ok: true, resolved });
}
