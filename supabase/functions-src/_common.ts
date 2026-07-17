/**
 * Shared edge-function runtime (bundled into each function by
 * scripts/bundle-functions.ts). Runs on Deno; supabase-js is left external
 * as an npm: import.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore deno npm specifier, resolved at deploy time
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import {
  CRYPTO,
  GOAL_PRESETS,
  autoRestPlan,
  resolveWeek,
  type Action,
  type GameSettings,
  type GameState,
  type PlayerState
} from "../../packages/engine/src/index";
import { ROOM_CODE_ALPHABET, type GameSettingsInput, type GameSnapshot } from "../../packages/shared/src/index";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};


export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    }
  });
}

export function fail(status: number, code: string, detail?: unknown): Response {
  return json({ error: code, detail }, status);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return json({ ok: true });
  return null;
}

/** Resolves the calling auth user (JWT already verified by the platform). */
export async function caller(req: Request, db: SupabaseClient): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ---------- game helpers ----------

export function generateCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

export function generateSeed(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0]!;
}

export function settingsToEngine(input: GameSettingsInput): GameSettings {
  const goals =
    input.goalPreset === "custom" && input.customGoals
      ? input.customGoals
      : GOAL_PRESETS[input.goalPreset === "custom" ? "quick" : input.goalPreset];
  return {
    goals: { ...goals },
    maxWeeks: input.maxWeeks,
    planTimerSeconds: input.planTimerSeconds
  };
}

interface GameRow {
  id: string;
  code: string;
  status: string;
  mode: string;
  host_id: string;
  settings: GameSettingsInput;
  seed: number;
  current_round: number;
  winner_id: string | null;
  global_state: { week: number; rentMultiplier: number; cryptoPrice: number } | null;
}

interface PlayerRow {
  game_id: string;
  player_id: string;
  slot: number;
  state: PlayerState;
  is_connected: boolean;
  profiles?: { display_name: string; avatar: string } | null;
}

export async function loadGame(db: SupabaseClient, gameId: string) {
  const { data: game, error } = await db.from("games").select("*").eq("id", gameId).single();
  if (error || !game) return null;
  const { data: players } = await db
    .from("game_players")
    .select("*, profiles(display_name, avatar)")
    .eq("game_id", gameId)
    .order("slot");
  return { game: game as GameRow, players: (players ?? []) as PlayerRow[] };
}

export function buildEngineState(game: GameRow, players: PlayerRow[]): GameState {
  const gs = game.global_state ?? { week: 1, rentMultiplier: 1, cryptoPrice: CRYPTO.startPrice };
  return {
    seed: Number(game.seed),
    week: gs.week,
    settings: settingsToEngine(game.settings),
    rentMultiplier: gs.rentMultiplier,
    cryptoPrice: gs.cryptoPrice,
    players: players.map((p) => p.state)
  };
}

export async function buildSnapshot(
  db: SupabaseClient,
  gameId: string,
  userId: string | null
): Promise<GameSnapshot | null> {
  const loaded = await loadGame(db, gameId);
  if (!loaded) return null;
  const { game, players } = loaded;

  let round: GameSnapshot["round"] = null;
  let myPlan: GameSnapshot["myPlan"] = null;
  if (game.current_round > 0) {
    const { data: r } = await db
      .from("rounds")
      .select("*")
      .eq("game_id", gameId)
      .eq("round_number", game.current_round)
      .single();
    if (r) {
      round = {
        roundNumber: r.round_number,
        status: r.status,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        resolvedAt: r.resolved_at
      };
      if (userId) {
        const { data: plan } = await db
          .from("round_plans")
          .select("plan")
          .eq("game_id", gameId)
          .eq("round_number", game.current_round)
          .eq("player_id", userId)
          .maybeSingle();
        myPlan = (plan?.plan as GameSnapshot["myPlan"]) ?? null;
      }
    }
  }

  const me = players.find((p) => p.player_id === userId);
  return {
    game: {
      id: game.id,
      code: game.code,
      status: game.status as GameSnapshot["game"]["status"],
      mode: game.mode as GameSnapshot["game"]["mode"],
      hostId: game.host_id,
      settings: game.settings,
      seed: Number(game.seed),
      currentRound: game.current_round,
      winnerId: game.winner_id,
      globalState: game.global_state
    },
    players: players.map((p) => ({
      playerId: p.player_id,
      slot: p.slot,
      displayName: p.profiles?.display_name ?? "?",
      avatar: p.profiles?.avatar ?? "a1",
      isConnected: p.is_connected,
      state: p.state
    })),
    round,
    myPlan,
    mySlot: me?.slot ?? null
  };
}

// ---------- the resolve core (idempotent, §3.3/§3.4) ----------

export interface ResolveOutcome {
  status: "resolved" | "already-resolved" | "not-ready" | "not-found" | "in-progress";
}

const STALE_RESOLVING_MS = 2 * 60 * 1000;

export async function resolveRoundCore(
  db: SupabaseClient,
  gameId: string,
  roundNumber: number
): Promise<ResolveOutcome> {
  const loaded = await loadGame(db, gameId);
  if (!loaded || loaded.game.status !== "active") return { status: "not-found" };
  const { game, players } = loaded;
  if (game.current_round !== roundNumber) return { status: "already-resolved" };

  const { data: round } = await db
    .from("rounds")
    .select("*")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber)
    .single();
  if (!round) return { status: "not-found" };
  if (round.status === "resolved") return { status: "already-resolved" };

  // Reset a stale 'resolving' claim (crashed function) — resolve is
  // deterministic, so recomputing is safe.
  if (round.status === "resolving") {
    const since = round.resolving_since ? Date.parse(round.resolving_since) : 0;
    if (Date.now() - since < STALE_RESOLVING_MS) return { status: "in-progress" };
    await db
      .from("rounds")
      .update({ status: "planning", resolving_since: null })
      .eq("game_id", gameId)
      .eq("round_number", roundNumber)
      .eq("status", "resolving");
  }

  // Gate: only resolve when timer expired OR all players submitted.
  const { data: plans } = await db
    .from("round_plans")
    .select("player_id, plan")
    .eq("game_id", gameId)
    .eq("round_number", roundNumber);
  const allSubmitted = (plans?.length ?? 0) >= players.length;
  const expired = Date.parse(round.ends_at) <= Date.now();
  if (!allSubmitted && !expired) return { status: "not-ready" };

  // CAS claim: planning → resolving. Exactly one caller wins.
  const { data: claimed } = await db
    .from("rounds")
    .update({ status: "resolving", resolving_since: new Date().toISOString() })
    .eq("game_id", gameId)
    .eq("round_number", roundNumber)
    .eq("status", "planning")
    .select();
  if (!claimed || claimed.length === 0) return { status: "in-progress" };

  // Build engine state + plans (auto-rest fill for non-submitters).
  const engineState = buildEngineState(game, players);
  const planBySlot = new Map<number, Action[]>();
  for (const p of players) {
    const submitted = plans?.find((x) => x.player_id === p.player_id);
    planBySlot.set(p.slot, (submitted?.plan as Action[]) ?? autoRestPlan());
  }

  const result = resolveWeek(engineState, planBySlot);

  // Persist: results, player states, game global state.
  await db.from("round_results").upsert({
    game_id: gameId,
    round_number: roundNumber,
    results: {
      week: result.week,
      players: result.players.map((p) => ({
        slot: p.slot,
        ledger: p.ledger,
        eventCards: p.eventCards,
        goalProgress: p.goalProgress,
        stateAfter: p.stateAfter
      })),
      globalEvents: result.globalEvents,
      standings: result.standings,
      winnerSlot: result.winnerSlot ?? null
    }
  });

  for (const p of players) {
    const after = result.nextState.players[p.slot]!;
    await db
      .from("game_players")
      .update({ state: after })
      .eq("game_id", gameId)
      .eq("player_id", p.player_id);
  }

  const winnerRow =
    result.winnerSlot !== undefined ? players.find((p) => p.slot === result.winnerSlot) : undefined;
  const gameFinished =
    result.winnerSlot !== undefined || result.nextState.week > engineState.settings.maxWeeks;

  if (gameFinished) {
    await db
      .from("games")
      .update({
        status: "finished",
        winner_id: winnerRow?.player_id ?? null,
        global_state: {
          week: result.nextState.week,
          rentMultiplier: result.nextState.rentMultiplier,
          cryptoPrice: result.nextState.cryptoPrice
        }
      })
      .eq("id", gameId);
  } else {
    const nextRound = roundNumber + 1;
    const timer = engineState.settings.planTimerSeconds;
    // Reveal window: clients show recap from resolved_at to resolved_at+18s,
    // next round timer starts after that (§3.4).
    const revealSeconds = 18;
    const endsAt = new Date(Date.now() + (revealSeconds + timer) * 1000).toISOString();
    await db.from("rounds").insert({
      game_id: gameId,
      round_number: nextRound,
      status: "planning",
      ends_at: endsAt
    });
    await db
      .from("games")
      .update({
        current_round: nextRound,
        global_state: {
          week: result.nextState.week,
          rentMultiplier: result.nextState.rentMultiplier,
          cryptoPrice: result.nextState.cryptoPrice
        }
      })
      .eq("id", gameId);
  }

  await db
    .from("rounds")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolving_since: null })
    .eq("game_id", gameId)
    .eq("round_number", roundNumber);

  return { status: "resolved" };
}
