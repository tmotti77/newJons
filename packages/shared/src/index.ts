/**
 * Shared zod schemas (DEV_PLAN §3.1): the SAME schemas validate on the
 * client (UX) and in edge functions (authority). Keep in sync with
 * packages/engine/src/types.ts — engine types are the source of truth.
 */

import { z } from "zod";

// ---------- primitives ----------

export const displayNameSchema = z.string().min(1).max(20);
export const avatarSchema = z.string().regex(/^a[1-8]$/);
export const gameModeSchema = z.enum(["live", "async", "solo"]);
export type GameMode = z.infer<typeof gameModeSchema>;

export const locationIdSchema = z.enum([
  "home", "burgerBarn", "college", "gadgetCity", "flipIt",
  "dressCode", "careerHub", "bank", "quickMart", "theSpot", "rentALord"
]);
export const itemIdSchema = z.enum(["phone", "tv", "console", "fridge", "laptop", "bike", "car"]);
export const outfitIdSchema = z.enum(["casual", "business", "luxury"]);
export const trackSchema = z.enum(["business", "tech", "trade"]);
export const jobTierSchema = z.union([
  z.literal(0), z.literal(1), z.literal(2), z.literal(3),
  z.literal(4), z.literal(5), z.literal(6)
]);
export const housingTierSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// ---------- actions (mirror of engine Action union, §3.10) ----------

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("travel"), to: locationIdSchema }),
  z.object({ type: z.literal("work"), tu: z.number().int().min(1).max(60) }),
  z.object({ type: z.literal("study"), courseTrack: trackSchema }),
  z.object({ type: z.literal("buy"), item: itemIdSchema }),
  z.object({ type: z.literal("buyOutfit"), outfit: outfitIdSchema }),
  z.object({ type: z.literal("sell"), item: itemIdSchema }),
  z.object({ type: z.literal("eat"), kind: z.enum(["basic", "bulk", "delivery"]) }),
  z.object({
    type: z.literal("bank"),
    op: z.enum(["deposit", "withdraw"]),
    amount: z.number().int().min(1).max(1_000_000)
  }),
  z.object({
    type: z.literal("crypto"),
    op: z.enum(["buy", "sell"]),
    amount: z.number().int().min(1).max(1_000_000)
  }),
  z.object({ type: z.literal("lottery"), tickets: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal("fun"), kind: z.enum(["club", "movie", "stream"]) }),
  z.object({ type: z.literal("payRent") }),
  z.object({ type: z.literal("moveApartment"), tier: housingTierSchema }),
  z.object({ type: z.literal("applyJob"), tier: jobTierSchema }),
  z.object({ type: z.literal("rest"), tu: z.number().int().min(1).max(60) })
]);
export type ActionInput = z.infer<typeof actionSchema>;

export const planSchema = z.array(actionSchema).max(40);

// ---------- game settings ----------

export const goalSetSchema = z.object({
  netWorth: z.number().int().min(500).max(100_000),
  happiness: z.number().int().min(30).max(100),
  courses: z.number().int().min(1).max(12),
  careerTier: jobTierSchema
});

export const gameSettingsSchema = z.object({
  goalPreset: z.enum(["quick", "classic", "marathon", "custom"]).default("quick"),
  customGoals: goalSetSchema.optional(),
  /** Low minimum is intentional: tests/dev use short timers. UI offers 60/90/120. */
  planTimerSeconds: z.number().int().min(5).max(300).default(90),
  maxWeeks: z.number().int().min(5).max(60).default(30)
});
export type GameSettingsInput = z.infer<typeof gameSettingsSchema>;

// ---------- edge function contracts (§3.9) ----------

export const createGameRequestSchema = z.object({
  displayName: displayNameSchema,
  avatar: avatarSchema,
  settings: gameSettingsSchema
});

export const joinGameRequestSchema = z.object({
  code: z.string().regex(/^[A-Z]{5}$/),
  displayName: displayNameSchema,
  avatar: avatarSchema
});

export const startGameRequestSchema = z.object({
  gameId: z.string().uuid()
});

export const submitPlanRequestSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.number().int().min(1),
  plan: planSchema
});

export const resolveRoundRequestSchema = z.object({
  gameId: z.string().uuid(),
  roundNumber: z.number().int().min(1)
});

export const rejoinGameRequestSchema = z.object({
  gameId: z.string().uuid()
});

export const leaveGameRequestSchema = z.object({
  gameId: z.string().uuid(),
  /** Host may pass another player's id to kick (lobby only). */
  playerId: z.string().uuid().optional()
});

// ---------- responses ----------

export interface PublicPlayer {
  playerId: string;
  slot: number;
  displayName: string;
  avatar: string;
  isConnected: boolean;
  state: unknown; // engine PlayerState (jsonb passthrough)
}

export interface GameSnapshot {
  game: {
    id: string;
    code: string;
    status: "lobby" | "active" | "finished" | "abandoned";
    mode: GameMode;
    hostId: string;
    settings: GameSettingsInput;
    seed: number;
    currentRound: number;
    winnerId: string | null;
    globalState: { week: number; rentMultiplier: number; cryptoPrice: number } | null;
  };
  players: PublicPlayer[];
  round: {
    roundNumber: number;
    status: "planning" | "resolving" | "resolved";
    startsAt: string;
    endsAt: string;
    resolvedAt: string | null;
  } | null;
  myPlan: ActionInput[] | null;
  mySlot: number | null;
}

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, no O
