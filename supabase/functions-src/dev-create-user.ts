/**
 * DEV ONLY: mints confirmed test users for the Phase 2 live-game simulator
 * (anonymous sign-in stays a dashboard toggle; this avoids needing it for
 * CI). Restricted to the @fastlane.test domain. Remove before launch —
 * tracked in DEV_PLAN §9 open decisions.
 */
import { admin, fail, handleOptions, json } from "./_common";


export async function handler(req: Request): Promise<Response> {
  const opt = handleOptions(req);
  if (opt) return opt;
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) return fail(400, "err.badRequest");
  if (!body.email.endsWith("@fastlane.test")) return fail(403, "err.devOnly");
  if (body.password.length < 8) return fail(400, "err.weakPassword");

  const db = admin();
  const { data, error } = await db.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true
  });
  if (error) {
    // Already exists → fine for repeated sim runs.
    if (String(error.message).toLowerCase().includes("already")) return json({ ok: true, existed: true });
    return fail(500, "err.createFailed", error.message);
  }
  return json({ ok: true, userId: data.user?.id });
}
