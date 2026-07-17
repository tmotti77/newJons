/**
 * Determinism property test (DEV_PLAN Phase 1): random games replayed
 * must produce byte-identical results. Random plan GENERATION here uses
 * its own seeded rng — the engine itself never sees Math.random().
 */
import { describe, expect, it } from "vitest";
import { mulberry32, type Rng } from "../rng";
import { resolveWeek } from "../resolve";
import { initialGameState } from "../state";
import type { Action, GameState, ItemId, LocationId, Track } from "../types";

const LOCATIONS: LocationId[] = [
  "home", "burgerBarn", "college", "gadgetCity", "flipIt",
  "dressCode", "careerHub", "bank", "quickMart", "theSpot", "rentALord"
];
const ITEM_IDS: ItemId[] = ["phone", "tv", "console", "fridge", "laptop", "bike", "car"];
const TRACKS: Track[] = ["business", "tech", "trade"];

export function randomAction(rng: Rng): Action {
  const roll = Math.floor(rng() * 14);
  switch (roll) {
    case 0: return { type: "travel", to: LOCATIONS[Math.floor(rng() * LOCATIONS.length)]! };
    case 1: return { type: "work", tu: 4 + Math.floor(rng() * 40) };
    case 2: return { type: "study", courseTrack: TRACKS[Math.floor(rng() * 3)]! };
    case 3: return { type: "buy", item: ITEM_IDS[Math.floor(rng() * ITEM_IDS.length)]! };
    case 4: return { type: "sell", item: ITEM_IDS[Math.floor(rng() * ITEM_IDS.length)]! };
    case 5: return { type: "eat", kind: (["basic", "bulk", "delivery"] as const)[Math.floor(rng() * 3)]! };
    case 6: return { type: "bank", op: rng() < 0.5 ? "deposit" : "withdraw", amount: Math.floor(rng() * 300) - 20 };
    case 7: return { type: "crypto", op: rng() < 0.5 ? "buy" : "sell", amount: Math.floor(rng() * 200) };
    case 8: return { type: "lottery", tickets: Math.floor(rng() * 12) };
    case 9: return { type: "fun", kind: (["club", "movie", "stream"] as const)[Math.floor(rng() * 3)]! };
    case 10: return { type: "payRent" };
    case 11: return { type: "moveApartment", tier: Math.floor(rng() * 3) as 0 | 1 | 2 };
    case 12: return { type: "applyJob", tier: Math.floor(rng() * 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
    default: return { type: "rest", tu: 1 + Math.floor(rng() * 70) };
  }
}

export function randomPlan(rng: Rng): Action[] {
  const len = Math.floor(rng() * 8);
  return Array.from({ length: len }, () => randomAction(rng));
}

function playGame(seed: number, weeks: number, players: number): string {
  const planRng = mulberry32(seed ^ 0xabcdef);
  let state: GameState = initialGameState(seed, players);
  const log: unknown[] = [];
  for (let w = 0; w < weeks; w++) {
    const plans = new Map<number, Action[]>();
    for (let s = 0; s < players; s++) plans.set(s, randomPlan(planRng));
    const result = resolveWeek(state, plans);
    log.push(result.players.map((p) => p.stateAfter));
    log.push(result.standings);
    state = result.nextState;
  }
  return JSON.stringify(log);
}

describe("determinism property", () => {
  it("1,000 random game-weeks replay identically", () => {
    // 100 games × 10 weeks = 1,000 resolved weeks, replayed twice.
    for (let g = 0; g < 100; g++) {
      const seed = g * 7919 + 13;
      const players = 2 + (g % 7); // 2..8
      const a = playGame(seed, 10, players);
      const b = playGame(seed, 10, players);
      expect(b).toBe(a);
    }
  });

  it("results differ across seeds (sanity)", () => {
    expect(playGame(1, 5, 3)).not.toBe(playGame(2, 5, 3));
  });
});
