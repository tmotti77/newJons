/**
 * State construction + derived-value helpers. Pure functions only.
 */

import {
  CRYPTO,
  DEFAULT_MAX_WEEKS,
  GOAL_PRESETS,
  HOUSING,
  ITEMS,
  LOCATION_ZONE,
  SHOP,
  STARTING,
  TRAVEL
} from "./config/balance";
import type {
  GameSettings,
  GameState,
  ItemId,
  LocationId,
  OutfitId,
  PlayerState,
  Track
} from "./types";

export function initialPlayerState(slot: number): PlayerState {
  return {
    slot,
    cash: STARTING.cash,
    bankBalance: STARTING.bankBalance,
    cryptoUnits: 0,
    happiness: STARTING.happiness,
    courses: { business: 0, tech: 0, trade: 0 },
    jobTier: STARTING.jobTier,
    weeksWorked: 0,
    housingTier: STARTING.housingTier,
    missedRentWeeks: 0,
    evicted: false,
    fedThisWeek: false,
    bulkFoodWeeks: 0,
    items: [],
    outfits: [],
    location: STARTING.location,
    lotteryTickets: 0,
    hasWon: false
  };
}

export function defaultSettings(preset: keyof typeof GOAL_PRESETS = "quick"): GameSettings {
  return {
    goals: { ...GOAL_PRESETS[preset] },
    maxWeeks: DEFAULT_MAX_WEEKS,
    planTimerSeconds: 90
  };
}

export function initialGameState(
  seed: number,
  playerCount: number,
  settings?: Partial<GameSettings>
): GameState {
  const base = defaultSettings();
  return {
    seed,
    week: 1,
    settings: {
      goals: settings?.goals ?? base.goals,
      maxWeeks: settings?.maxWeeks ?? base.maxWeeks,
      planTimerSeconds: settings?.planTimerSeconds ?? base.planTimerSeconds
    },
    rentMultiplier: 1,
    cryptoPrice: CRYPTO.startPrice,
    players: Array.from({ length: playerCount }, (_, i) => initialPlayerState(i))
  };
}

// ---------- derived values ----------

export function totalCourses(p: PlayerState): number {
  return p.courses.business + p.courses.tech + p.courses.trade;
}

export function itemValue(id: ItemId): number {
  const def = ITEMS.find((i) => i.id === id);
  return def ? def.price : 0;
}

export function itemResaleValue(id: ItemId): number {
  return Math.floor((itemValue(id) * SHOP.sellPct) / 100);
}

export function netWorth(p: PlayerState, cryptoPrice: number): number {
  const itemsWorth = p.items.reduce((sum, id) => sum + itemResaleValue(id), 0);
  return Math.floor(p.cash + p.bankBalance + p.cryptoUnits * cryptoPrice + itemsWorth);
}

export function currentRent(state: GameState, p: PlayerState): number {
  const housing = HOUSING[p.housingTier];
  if (!housing) throw new Error(`bad housing tier ${p.housingTier}`);
  return Math.round(housing.rentPerWeek * state.rentMultiplier);
}

export function hasUsableOutfit(p: PlayerState, outfit: OutfitId): boolean {
  return p.outfits.some((o) => o.outfit === outfit && o.weeksLeft > 0);
}

export function travelCost(p: PlayerState, from: LocationId, to: LocationId): number {
  if (from === to) return 0;
  const base =
    LOCATION_ZONE[from] === LOCATION_ZONE[to] ? TRAVEL.adjacentTU : TRAVEL.acrossTownTU;
  let discount = 0;
  if (p.items.includes("car")) discount = TRAVEL.carDiscount;
  else if (p.items.includes("bike")) discount = TRAVEL.bikeDiscount;
  return Math.max(TRAVEL.minTU, base - discount);
}

export function trackWithMostCourses(p: PlayerState): Track {
  const entries: [Track, number][] = [
    ["business", p.courses.business],
    ["tech", p.courses.tech],
    ["trade", p.courses.trade]
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]![0];
}
