/**
 * Single edge function exposing the whole §3.9 API surface as sub-routes:
 * POST /functions/v1/api/create-game, /join-game, /start-game, /submit-plan,
 * /resolve-round, /rejoin-game, /leave-game, /sweep-rounds, /dev-create-user.
 * One deploy artifact; handlers live in sibling modules.
 */
import { handler as createGame } from "./create-game";
import { handler as devCreateUser } from "./dev-create-user";
import { handler as joinGame } from "./join-game";
import { handler as leaveGame } from "./leave-game";
import { handler as rejoinGame } from "./rejoin-game";
import { handler as resolveRound } from "./resolve-round";
import { handler as startGame } from "./start-game";
import { handler as submitPlan } from "./submit-plan";
import { handler as sweepRounds } from "./sweep-rounds";
import { fail, handleOptions } from "./_common";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "create-game": createGame,
  "join-game": joinGame,
  "start-game": startGame,
  "submit-plan": submitPlan,
  "resolve-round": resolveRound,
  "rejoin-game": rejoinGame,
  "leave-game": leaveGame,
  "sweep-rounds": sweepRounds,
  "dev-create-user": devCreateUser
};

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return fail(405, "err.methodNotAllowed");
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const route = segments[segments.length - 1] ?? "";
  const handler = ROUTES[route];
  if (!handler) return fail(404, "err.unknownRoute", { route });
  try {
    return await handler(req);
  } catch (e) {
    console.error(`[api/${route}]`, e);
    return fail(500, "err.internal", String(e));
  }
});
