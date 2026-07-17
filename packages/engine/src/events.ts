/**
 * Random events (DEV_PLAN §2.6). All rolls flow from rngFor(seed, week, lane)
 * — global economy events use GLOBAL_LANE, personal events use the player's
 * slot lane so each player's luck is an independent, replayable stream.
 */

import { CRYPTO, EVENTS, RENT } from "./config/balance";
import { GLOBAL_LANE, chance, rngFor, symmetric } from "./rng";
import type { EventCard, GameState } from "./types";

export interface GlobalEventOutcomes {
  cards: EventCard[];
  newCryptoPrice: number;
  newRentMultiplier: number;
  recession: boolean;
}

/** Weekly global rolls: crypto move, scheduled rent hikes, market heat, recession. */
export function rollGlobalEvents(state: GameState): GlobalEventOutcomes {
  const rng = rngFor(state.seed, state.week, GLOBAL_LANE);
  const cards: EventCard[] = [];

  // Crypto price move (±volatility, floored).
  const movePct = symmetric(rng, CRYPTO.volatilityPct);
  const newCryptoPrice = Math.max(
    CRYPTO.minPrice,
    Math.round(state.cryptoPrice * (1 + movePct / 100) * 100) / 100
  );
  if (Math.abs(movePct) >= CRYPTO.volatilityPct * 0.6) {
    cards.push({
      id: `crypto-${state.week}`,
      category: "economy",
      key: movePct > 0 ? "event.cryptoPump" : "event.cryptoDump",
      params: { pct: Math.abs(Math.round(movePct)) },
      affectedSlots: []
    });
  }

  // Scheduled rent hike every N weeks (§2.4).
  let newRentMultiplier = state.rentMultiplier;
  if (state.week > 1 && state.week % RENT.globalHikeIntervalWeeks === 0) {
    newRentMultiplier = Math.round(newRentMultiplier * (1 + RENT.globalHikePct / 100) * 100) / 100;
    cards.push({
      id: `renthike-${state.week}`,
      category: "economy",
      key: "event.rentHike",
      params: { pct: RENT.globalHikePct },
      affectedSlots: []
    });
  }

  // Market heat: random extra hike.
  if (chance(rng, EVENTS.marketHeat.chancePct)) {
    newRentMultiplier =
      Math.round(newRentMultiplier * (1 + EVENTS.marketHeat.extraHikePct / 100) * 100) / 100;
    cards.push({
      id: `heat-${state.week}`,
      category: "economy",
      key: "event.marketHeat",
      params: { pct: EVENTS.marketHeat.extraHikePct },
      affectedSlots: []
    });
  }

  // Recession: layoff risk for T3+ this week (§2.5).
  const recession = chance(rng, EVENTS.recession.chancePct);
  if (recession) {
    cards.push({
      id: `recession-${state.week}`,
      category: "economy",
      key: "event.recession",
      affectedSlots: []
    });
  }

  return { cards, newCryptoPrice, newRentMultiplier, recession };
}

export interface PersonalEventOutcomes {
  cards: EventCard[];
  cashDelta: number;
  happinessDelta: number;
  /** Wage multiplier from events this week (overtime / shift cancelled). */
  wageMultiplier: number;
  lostPhone: boolean;
  laidOff: boolean;
}

/**
 * Per-player event rolls. `workedTU` and `wasHungry` reflect this week's
 * resolved plan; `recession` comes from the global roll.
 */
export function rollPersonalEvents(
  state: GameState,
  slot: number,
  ctx: { cashOnHand: number; workedTU: number; wasHungryLastWeek: boolean; recession: boolean }
): PersonalEventOutcomes {
  const rng = rngFor(state.seed, state.week, slot);
  const player = state.players[slot];
  const cards: EventCard[] = [];
  let cashDelta = 0;
  let happinessDelta = 0;
  let wageMultiplier = 1;
  let lostPhone = false;
  let laidOff = false;
  const cap = EVENTS.maxPersonalEventsPerPlayerPerWeek;

  const push = (card: EventCard) => {
    if (cards.length < cap) cards.push(card);
  };

  // Robbery: carrying too much cash (§2.6).
  if (
    ctx.cashOnHand > EVENTS.robbery.cashThreshold &&
    chance(rng, EVENTS.robbery.chancePct)
  ) {
    const lost = Math.floor((ctx.cashOnHand * EVENTS.robbery.losePct) / 100);
    cashDelta -= lost;
    push({
      id: `robbery-${state.week}-${slot}`,
      category: "personal",
      key: "event.robbery",
      params: { amount: lost },
      affectedSlots: [slot]
    });
  }

  // Sickness when hungry.
  if (ctx.wasHungryLastWeek && chance(rng, EVENTS.sickness.chancePctWhenHungry)) {
    cashDelta -= EVENTS.sickness.cost;
    happinessDelta -= EVENTS.sickness.happinessPenalty;
    push({
      id: `sick-${state.week}-${slot}`,
      category: "personal",
      key: "event.sickness",
      params: { cost: EVENTS.sickness.cost },
      affectedSlots: [slot]
    });
  }

  // Found wallet.
  if (chance(rng, EVENTS.foundWallet.chancePct)) {
    cashDelta += EVENTS.foundWallet.amount;
    push({
      id: `wallet-${state.week}-${slot}`,
      category: "personal",
      key: "event.foundWallet",
      params: { amount: EVENTS.foundWallet.amount },
      affectedSlots: [slot]
    });
  }

  // Phone broke.
  if (player && player.items.includes("phone") && chance(rng, EVENTS.phoneBroke.chancePct)) {
    lostPhone = true;
    push({
      id: `phone-${state.week}-${slot}`,
      category: "personal",
      key: "event.phoneBroke",
      affectedSlots: [slot]
    });
  }

  // Work events only when the player worked this week.
  if (ctx.workedTU > 0) {
    if (chance(rng, EVENTS.overtimeBonus.chancePct)) {
      wageMultiplier *= 1 + EVENTS.overtimeBonus.bonusPct / 100;
      push({
        id: `overtime-${state.week}-${slot}`,
        category: "personal",
        key: "event.overtime",
        params: { pct: EVENTS.overtimeBonus.bonusPct },
        affectedSlots: [slot]
      });
    } else if (chance(rng, EVENTS.shiftCancelled.chancePct)) {
      wageMultiplier *= 0.5;
      push({
        id: `cancelled-${state.week}-${slot}`,
        category: "personal",
        key: "event.shiftCancelled",
        affectedSlots: [slot]
      });
    }
  }

  // Layoffs during recession for T3+ (§2.5).
  if (
    ctx.recession &&
    player &&
    player.jobTier >= EVENTS.layoff.minTier &&
    chance(rng, EVENTS.layoff.chancePct * 3) // recession triples layoff odds
  ) {
    laidOff = true;
    push({
      id: `layoff-${state.week}-${slot}`,
      category: "personal",
      key: "event.layoff",
      affectedSlots: [slot]
    });
  }

  return { cards, cashDelta, happinessDelta, wageMultiplier, lostPhone, laidOff };
}
