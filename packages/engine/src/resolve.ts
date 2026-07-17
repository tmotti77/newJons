/**
 * resolveWeek (DEV_PLAN §3.3/§3.10): the ONLY code path that advances game
 * state. Deterministic: same (state, plans, seed-derived rolls) → identical
 * WeekResult. The server calls this; clients only render its output.
 *
 * Order of operations per player:
 *   1. Execute the validated plan (invalid plans → auto-rest).
 *   2. Credit wages (with burnout/hunger/event multipliers).
 *   3. Roll personal events.
 *   4. Weekly upkeep: rent, food check, happiness decay + item/housing
 *      bonuses, bank interest, lottery draw, outfit wear, unspent-TU rest.
 * Then global: crypto price, rent hikes, standings, winner check.
 */

import {
  BANK,
  CRYPTO,
  EDUCATION,
  FOOD,
  FUN,
  HAPPINESS,
  HOUSING,
  ITEMS,
  JOBS,
  LOTTERY,
  OUTFITS,
  RENT,
  SHOP,
  TIME_UNITS_PER_WEEK
} from "./config/balance";
import { rollGlobalEvents, rollPersonalEvents } from "./events";
import { capWinner, goalProgress, standings as computeStandings, weekWinner } from "./goals";
import { chance, rngFor } from "./rng";
import { currentRent, travelCost } from "./state";
import type {
  Action,
  EventCard,
  GameState,
  LedgerLine,
  PlayerState,
  PlayerWeekResult,
  WeekResult
} from "./types";
import { validatePlan } from "./validate";

/** The plan substituted for missing/invalid submissions (§3.4). */
export function autoRestPlan(): Action[] {
  return [{ type: "rest", tu: TIME_UNITS_PER_WEEK }];
}

function clampHappiness(h: number): number {
  return Math.max(HAPPINESS.min, Math.min(HAPPINESS.max, Math.round(h)));
}

interface ExecOutcome {
  player: PlayerState;
  ledger: LedgerLine[];
  workedTU: number;
  tuUsed: number;
  funHappiness: number;
  ateThisWeek: boolean;
  rentPaidInPlan: boolean;
}

/**
 * Applies a (pre-validated) plan to a copy of the player state.
 * Wages are NOT credited here — they depend on multipliers resolved later.
 */
function executePlan(state: GameState, p: PlayerState, plan: Action[]): ExecOutcome {
  const np: PlayerState = structuredClone(p);
  const ledger: LedgerLine[] = [];
  let workedTU = 0;
  let tuUsed = 0;
  let funHappiness = 0;
  let ate = false;
  let rentPaid = false;

  for (const action of plan) {
    switch (action.type) {
      case "travel": {
        const cost = travelCost(np, np.location, action.to);
        tuUsed += cost;
        np.location = action.to;
        break;
      }
      case "work": {
        workedTU += action.tu;
        tuUsed += action.tu;
        break;
      }
      case "study": {
        const atHome = np.location === "home";
        tuUsed += atHome
          ? EDUCATION.courseTU - EDUCATION.laptopTUDiscount
          : EDUCATION.courseTU;
        np.cash -= EDUCATION.courseCost;
        np.courses[action.courseTrack] += 1;
        ledger.push({
          key: "ledger.courseDone",
          params: { track: action.courseTrack },
          cashDelta: -EDUCATION.courseCost
        });
        break;
      }
      case "buy": {
        const def = ITEMS.find((it) => it.id === action.item)!;
        const price =
          np.location === "flipIt" ? Math.floor((def.price * SHOP.usedBuyPct) / 100) : def.price;
        np.cash -= price;
        np.items.push(action.item);
        tuUsed += SHOP.buyTU;
        ledger.push({ key: "ledger.bought", params: { item: action.item }, cashDelta: -price });
        break;
      }
      case "buyOutfit": {
        const def = OUTFITS.find((o) => o.id === action.outfit)!;
        np.cash -= def.price;
        tuUsed += SHOP.buyTU;
        const existing = np.outfits.find((o) => o.outfit === action.outfit);
        if (existing) existing.weeksLeft = def.wearWeeks;
        else np.outfits.push({ outfit: action.outfit, weeksLeft: def.wearWeeks });
        ledger.push({
          key: "ledger.boughtOutfit",
          params: { outfit: action.outfit },
          cashDelta: -def.price
        });
        break;
      }
      case "sell": {
        const def = ITEMS.find((it) => it.id === action.item)!;
        const value = Math.floor((def.price * SHOP.sellPct) / 100);
        np.items.splice(np.items.indexOf(action.item), 1);
        np.cash += value;
        tuUsed += SHOP.buyTU;
        ledger.push({ key: "ledger.sold", params: { item: action.item }, cashDelta: value });
        break;
      }
      case "eat": {
        if (action.kind === "basic") np.cash -= FOOD.basicCost;
        else if (action.kind === "bulk") {
          np.cash -= FOOD.bulkCost;
          np.bulkFoodWeeks += FOOD.bulkWeeks;
        } else np.cash -= FOOD.deliveryCost;
        tuUsed += FOOD.eatTU;
        ate = true;
        break;
      }
      case "bank": {
        if (action.op === "deposit") {
          np.cash -= action.amount;
          np.bankBalance += action.amount;
        } else {
          np.bankBalance -= action.amount;
          np.cash += action.amount;
        }
        tuUsed += BANK.bankTU;
        break;
      }
      case "crypto": {
        if (action.op === "buy") {
          np.cash -= action.amount;
          np.cryptoUnits += action.amount / state.cryptoPrice;
        } else {
          np.cryptoUnits -= action.amount / state.cryptoPrice;
          np.cash += action.amount;
        }
        tuUsed += CRYPTO.tradeTU;
        ledger.push({
          key: action.op === "buy" ? "ledger.cryptoBuy" : "ledger.cryptoSell",
          params: { amount: action.amount },
          cashDelta: action.op === "buy" ? -action.amount : action.amount
        });
        break;
      }
      case "lottery": {
        const cost = action.tickets * LOTTERY.ticketCost;
        np.cash -= cost;
        np.lotteryTickets += action.tickets;
        tuUsed += LOTTERY.buyTU;
        ledger.push({
          key: "ledger.lottery",
          params: { tickets: action.tickets },
          cashDelta: -cost
        });
        break;
      }
      case "fun": {
        const def = FUN[action.kind];
        np.cash -= def.cost;
        funHappiness += def.happiness;
        tuUsed += def.tu;
        ledger.push({
          key: `ledger.fun.${action.kind}`,
          cashDelta: -def.cost,
          happinessDelta: def.happiness
        });
        break;
      }
      case "payRent": {
        const rent = currentRent(state, p);
        np.cash -= rent;
        tuUsed += BANK.bankTU;
        rentPaid = true;
        ledger.push({ key: "ledger.rentPaid", params: { amount: rent }, cashDelta: -rent });
        break;
      }
      case "moveApartment": {
        const housing = HOUSING[action.tier]!;
        const deposit = Math.round(
          housing.rentPerWeek * state.rentMultiplier * RENT.depositWeeks
        );
        np.cash -= deposit;
        np.housingTier = action.tier;
        np.evicted = false;
        np.missedRentWeeks = 0;
        tuUsed += RENT.moveTU;
        ledger.push({
          key: "ledger.moved",
          params: { housing: housing.nameKey },
          cashDelta: -deposit
        });
        break;
      }
      case "applyJob": {
        np.jobTier = action.tier;
        tuUsed += BANK.bankTU;
        ledger.push({ key: "ledger.newJob", params: { tier: action.tier } });
        break;
      }
      case "rest": {
        tuUsed += action.tu;
        break;
      }
    }
  }

  return {
    player: np,
    ledger,
    workedTU,
    tuUsed,
    funHappiness,
    ateThisWeek: ate,
    rentPaidInPlan: rentPaid
  };
}

export function resolveWeek(
  state: GameState,
  plansBySlot: ReadonlyMap<number, Action[]>
): WeekResult {
  const global = rollGlobalEvents(state);
  const playerResults: PlayerWeekResult[] = [];
  const nextPlayers: PlayerState[] = [];

  for (const p of state.players) {
    const stateBefore = structuredClone(p);
    const submitted = plansBySlot.get(p.slot);
    const validation = submitted ? validatePlan(state, p.slot, submitted) : null;
    const plan = submitted && validation?.ok ? submitted : autoRestPlan();
    const usedAutoRest = plan !== submitted;

    const exec = executePlan(state, p, plan);
    const np = exec.player;
    const ledger = exec.ledger;
    const cards: EventCard[] = [];

    if (usedAutoRest) ledger.unshift({ key: "ledger.autoRest" });

    // ---- 2. wages ----
    const wasHungryLastWeek = !p.fedThisWeek && state.week > 1;
    if (exec.workedTU > 0) {
      const tier = np.jobTier === -1 ? 0 : np.jobTier;
      const job = JOBS.find((j) => j.tier === tier)!;
      let multiplier = 1;
      if (p.happiness < HAPPINESS.burnoutThreshold) multiplier *= HAPPINESS.burnoutWageMultiplier;
      if (wasHungryLastWeek) multiplier *= FOOD.hungryWageMultiplier;

      const personal = rollPersonalEvents(state, p.slot, {
        cashOnHand: np.cash,
        workedTU: exec.workedTU,
        wasHungryLastWeek,
        recession: global.recession
      });
      multiplier *= personal.wageMultiplier;

      const wages = Math.floor(exec.workedTU * job.wagePerTU * multiplier);
      np.cash += wages;
      np.weeksWorked += 1;
      ledger.push({
        key: "ledger.wages",
        params: { tu: exec.workedTU, job: job.nameKey },
        cashDelta: wages
      });

      applyPersonalEvents(np, personal, ledger, cards);
    } else {
      const personal = rollPersonalEvents(state, p.slot, {
        cashOnHand: np.cash,
        workedTU: 0,
        wasHungryLastWeek,
        recession: global.recession
      });
      applyPersonalEvents(np, personal, ledger, cards);
    }

    // ---- 4. weekly upkeep ----

    // Rent (auto-charged if not paid in plan, §2.4).
    if (!np.evicted) {
      if (!exec.rentPaidInPlan) {
        const rent = currentRent(state, p);
        if (np.cash >= rent) {
          np.cash -= rent;
          np.missedRentWeeks = 0;
          ledger.push({ key: "ledger.rentAutoPaid", params: { amount: rent }, cashDelta: -rent });
        } else {
          np.missedRentWeeks += 1;
          if (np.missedRentWeeks >= 2) {
            np.evicted = true;
            np.housingTier = 0;
            np.missedRentWeeks = 0;
            np.happiness -= RENT.evictionHappinessPenalty;
            ledger.push({
              key: "ledger.evicted",
              happinessDelta: -RENT.evictionHappinessPenalty
            });
            cards.push({
              id: `evicted-${state.week}-${p.slot}`,
              category: "personal",
              key: "event.evicted",
              affectedSlots: [p.slot]
            });
          } else {
            np.happiness -= RENT.lateNoticeHappinessPenalty;
            ledger.push({
              key: "ledger.lateNotice",
              happinessDelta: -RENT.lateNoticeHappinessPenalty
            });
          }
        }
      } else {
        np.missedRentWeeks = 0;
      }
    } else {
      np.happiness -= RENT.shelterHappinessPenalty;
      ledger.push({ key: "ledger.shelter", happinessDelta: -RENT.shelterHappinessPenalty });
    }

    // Food: bulk stock counts as eating.
    let fed = exec.ateThisWeek;
    if (!fed && np.bulkFoodWeeks > 0) {
      np.bulkFoodWeeks -= 1;
      fed = true;
      ledger.push({ key: "ledger.ateFromFridge" });
    }
    if (!fed) {
      np.happiness -= FOOD.missedMealHappinessPenalty;
      ledger.push({
        key: "ledger.wentHungry",
        happinessDelta: -FOOD.missedMealHappinessPenalty
      });
    }
    np.fedThisWeek = fed;

    // Happiness: decay + housing + items + fun + rest.
    np.happiness -= HAPPINESS.weeklyDecay;
    const housingBonus = np.evicted ? 0 : HOUSING[np.housingTier]!.happinessPerWeek;
    np.happiness += housingBonus;
    const itemBonus = np.items.reduce(
      (sum, id) => sum + (ITEMS.find((it) => it.id === id)?.happinessPerWeek ?? 0),
      0
    );
    np.happiness += itemBonus;
    np.happiness += exec.funHappiness;

    // Unspent TU → rest (+2 per 10 TU block, §2.2).
    const unspent = Math.max(0, TIME_UNITS_PER_WEEK - exec.tuUsed);
    const restBlocks = Math.floor(unspent / HAPPINESS.restBlockTU);
    if (restBlocks > 0) {
      const bonus = restBlocks * HAPPINESS.restBonusPerBlock;
      np.happiness += bonus;
      ledger.push({ key: "ledger.rested", params: { tu: unspent }, happinessDelta: bonus });
    }

    // Bank interest.
    if (np.bankBalance > 0) {
      const interest = Math.floor((np.bankBalance * BANK.weeklyInterestPct) / 100);
      if (interest > 0) {
        np.bankBalance += interest;
        ledger.push({ key: "ledger.interest", cashDelta: interest });
      }
    }

    // Lottery draw (per-ticket, own RNG sub-lane via same player stream).
    if (np.lotteryTickets > 0) {
      const rng = rngFor(state.seed, state.week, 500 + p.slot);
      let won = false;
      for (let t = 0; t < np.lotteryTickets; t++) {
        if (chance(rng, 100 / LOTTERY.oddsOneIn)) won = true;
      }
      if (won) {
        np.cash += LOTTERY.jackpot;
        ledger.push({ key: "ledger.jackpot", cashDelta: LOTTERY.jackpot });
        cards.push({
          id: `jackpot-${state.week}-${p.slot}`,
          category: "jackpot",
          key: "event.jackpot",
          params: { amount: LOTTERY.jackpot },
          affectedSlots: [p.slot]
        });
      }
      np.lotteryTickets = 0;
    }

    // Outfit wear (§2.3: wear out after N weeks).
    np.outfits = np.outfits
      .map((o) => ({ ...o, weeksLeft: o.weeksLeft - 1 }))
      .filter((o) => o.weeksLeft > 0);

    // Job dress-code check for next week: losing the outfit demotes to gig.
    if (np.jobTier > 0) {
      const job = JOBS.find((j) => j.tier === np.jobTier)!;
      const outfit = job.requirements.outfit;
      if (outfit && !np.outfits.some((o) => o.outfit === outfit && o.weeksLeft > 0)) {
        np.jobTier = 0;
        ledger.push({ key: "ledger.demotedNoOutfit" });
      }
    }

    np.happiness = clampHappiness(np.happiness);
    np.cash = Math.max(0, Math.round(np.cash * 100) / 100);
    np.bankBalance = Math.round(np.bankBalance * 100) / 100;
    np.cryptoUnits = Math.round(np.cryptoUnits * 1e6) / 1e6;

    nextPlayers.push(np);
    playerResults.push({
      slot: p.slot,
      stateBefore,
      stateAfter: np,
      ledger,
      eventCards: cards,
      goalProgress: goalProgress(state, np) // progress vs current goals; recomputed on nextState below
    });
  }

  // ---- global state advance ----
  const nextState: GameState = {
    ...state,
    week: state.week + 1,
    rentMultiplier: global.newRentMultiplier,
    cryptoPrice: global.newCryptoPrice,
    players: nextPlayers
  };

  // Recompute goal progress against the *post-week* state (crypto price moved).
  for (const pr of playerResults) {
    const np = nextState.players[pr.slot]!;
    pr.goalProgress = goalProgress(nextState, np);
    np.hasWon = pr.goalProgress.achievedAll;
  }

  const standings = computeStandings(nextState);
  let winnerSlot = weekWinner(nextState);
  if (winnerSlot === undefined && nextState.week > state.settings.maxWeeks) {
    winnerSlot = capWinner(nextState);
  }

  return {
    week: state.week,
    players: playerResults,
    globalEvents: global.cards,
    standings,
    ...(winnerSlot !== undefined ? { winnerSlot } : {}),
    nextState
  };
}

function applyPersonalEvents(
  np: PlayerState,
  personal: ReturnType<typeof rollPersonalEvents>,
  ledger: LedgerLine[],
  cards: EventCard[]
): void {
  if (personal.cashDelta !== 0) {
    np.cash = Math.max(0, np.cash + personal.cashDelta);
  }
  if (personal.happinessDelta !== 0) {
    np.happiness += personal.happinessDelta;
  }
  if (personal.lostPhone) {
    const idx = np.items.indexOf("phone");
    if (idx !== -1) np.items.splice(idx, 1);
  }
  if (personal.laidOff && np.jobTier >= 0) {
    np.jobTier = 0;
  }
  for (const card of personal.cards) {
    cards.push(card);
    ledger.push({ key: card.key, params: card.params ?? {} });
  }
}
