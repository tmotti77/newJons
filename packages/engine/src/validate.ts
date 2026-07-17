/**
 * validatePlan (DEV_PLAN §3.10): simulates the ordered Action[] sequentially
 * against a copy of the player state — location context, TU budget, cash
 * never below 0 mid-plan, dress code, job requirements. Client uses it for
 * instant UX; the resolve function re-runs it as the authority.
 */

import {
  BANK,
  CRYPTO,
  EDUCATION,
  FOOD,
  FUN,
  HOUSING,
  ITEMS,
  JOBS,
  LOTTERY,
  OUTFITS,
  RENT,
  SHOP,
  TIME_UNITS_PER_WEEK,
  WORK
} from "./config/balance";
import { currentRent, totalCourses, travelCost } from "./state";
import type {
  Action,
  ActionError,
  GameState,
  PlayerState,
  ValidationResult
} from "./types";

interface SimCursor {
  cash: number;
  bankBalance: number;
  cryptoUnits: number;
  location: PlayerState["location"];
  tuUsed: number;
  workTU: number;
  items: PlayerState["items"];
  outfits: PlayerState["outfits"];
  bulkFoodWeeks: number;
  ate: boolean;
  lotteryTickets: number;
  housingTier: PlayerState["housingTier"];
  evicted: boolean;
  jobTier: PlayerState["jobTier"];
  rentPaid: boolean;
}

function cursorFrom(p: PlayerState): SimCursor {
  return {
    cash: p.cash,
    bankBalance: p.bankBalance,
    cryptoUnits: p.cryptoUnits,
    location: p.location,
    tuUsed: 0,
    workTU: 0,
    items: [...p.items],
    outfits: p.outfits.map((o) => ({ ...o })),
    bulkFoodWeeks: p.bulkFoodWeeks,
    ate: false,
    lotteryTickets: 0,
    housingTier: p.housingTier,
    evicted: p.evicted,
    jobTier: p.jobTier,
    rentPaid: false
  };
}

export function meetsJobRequirements(
  state: GameState,
  p: PlayerState,
  cursor: SimCursor,
  tier: number
): string | null {
  const job = JOBS.find((j) => j.tier === tier);
  if (!job) return "err.job.unknown";
  const req = job.requirements;
  const courses = totalCourses(p);
  if (req.courses !== undefined && courses < req.courses) return "err.job.courses";
  if (req.degree && courses < EDUCATION.degreeCourses) return "err.job.degree";
  if (req.track && p.courses[req.track] < (req.courses ?? 0)) return "err.job.track";
  if (req.weeksWorked !== undefined && p.weeksWorked < req.weeksWorked)
    return "err.job.experience";
  if (req.outfit && !cursor.outfits.some((o) => o.outfit === req.outfit && o.weeksLeft > 0))
    return "err.job.outfit";
  if (req.items && !req.items.every((i) => cursor.items.includes(i))) return "err.job.items";
  return null;
}

export function validatePlan(
  state: GameState,
  playerSlot: number,
  plan: Action[]
): ValidationResult {
  const player = state.players[playerSlot];
  if (!player) {
    return { ok: false, errors: [{ index: -1, code: "err.player.unknown" }] };
  }

  const errors: ActionError[] = [];
  const c = cursorFrom(player);
  const err = (index: number, code: string, params?: Record<string, string | number>) =>
    errors.push(params ? { index, code, params } : { index, code });

  plan.forEach((action, i) => {
    // Every action first pays its TU cost; overruns are per-action errors.
    const spendTU = (tu: number): boolean => {
      if (c.tuUsed + tu > TIME_UNITS_PER_WEEK) {
        err(i, "err.tu.overrun", { need: tu, left: TIME_UNITS_PER_WEEK - c.tuUsed });
        return false;
      }
      c.tuUsed += tu;
      return true;
    };
    const spendCash = (amount: number): boolean => {
      if (amount > c.cash) {
        err(i, "err.cash.insufficient", { need: amount, have: c.cash });
        return false;
      }
      c.cash -= amount;
      return true;
    };

    switch (action.type) {
      case "travel": {
        if (action.to === c.location) {
          err(i, "err.travel.samePlace");
          break;
        }
        const cost = travelCost(player, c.location, action.to);
        if (!spendTU(cost)) break;
        c.location = action.to;
        break;
      }

      case "work": {
        if (!Number.isInteger(action.tu) || action.tu < WORK.minShiftTU) {
          err(i, "err.work.shiftTooShort", { min: WORK.minShiftTU });
          break;
        }
        if (c.workTU + action.tu > WORK.maxWeeklyTU) {
          err(i, "err.work.weeklyCap", { cap: WORK.maxWeeklyTU });
          break;
        }
        const tier = c.jobTier === -1 ? 0 : c.jobTier; // unemployed → gig
        const job = JOBS.find((j) => j.tier === tier);
        if (!job) {
          err(i, "err.job.unknown");
          break;
        }
        if (tier === 0 && !c.items.includes("phone")) {
          err(i, "err.work.needPhone");
          break;
        }
        if (job.location !== null && c.location !== job.location) {
          err(i, "err.work.wrongLocation", { location: job.location });
          break;
        }
        // Dress code enforced while employed at outfit-gated tiers.
        const outfitReq = job.requirements.outfit;
        if (outfitReq && !c.outfits.some((o) => o.outfit === outfitReq && o.weeksLeft > 0)) {
          err(i, "err.work.dressCode", { outfit: outfitReq });
          break;
        }
        if (!spendTU(action.tu)) break;
        c.workTU += action.tu;
        // Wages are credited at resolve (events can modify them), so cash
        // does NOT increase mid-plan. This is the conservative reading of
        // "cash never <0 mid-plan": you can't spend unearned wages.
        break;
      }

      case "study": {
        const atCollege = c.location === "college";
        const atHomeWithLaptop = c.location === "home" && c.items.includes("laptop");
        if (!atCollege && !atHomeWithLaptop) {
          err(i, "err.study.wrongLocation");
          break;
        }
        const tu = atHomeWithLaptop
          ? EDUCATION.courseTU - EDUCATION.laptopTUDiscount
          : EDUCATION.courseTU;
        if (!spendCash(EDUCATION.courseCost)) break;
        if (!spendTU(tu)) break;
        break;
      }

      case "buy": {
        const def = ITEMS.find((it) => it.id === action.item);
        if (!def) {
          err(i, "err.buy.unknownItem");
          break;
        }
        if (c.items.includes(action.item)) {
          err(i, "err.buy.alreadyOwned");
          break;
        }
        const usedShop = c.location === "flipIt";
        if (c.location !== def.buyAt && !usedShop) {
          err(i, "err.buy.wrongLocation", { location: def.buyAt });
          break;
        }
        const price = usedShop ? Math.floor((def.price * SHOP.usedBuyPct) / 100) : def.price;
        if (!spendCash(price)) break;
        if (!spendTU(SHOP.buyTU)) break;
        c.items.push(action.item);
        break;
      }

      case "buyOutfit": {
        if (c.location !== "dressCode") {
          err(i, "err.buy.wrongLocation", { location: "dressCode" });
          break;
        }
        const def = OUTFITS.find((o) => o.id === action.outfit);
        if (!def) {
          err(i, "err.buy.unknownItem");
          break;
        }
        if (!spendCash(def.price)) break;
        if (!spendTU(SHOP.buyTU)) break;
        const existing = c.outfits.find((o) => o.outfit === action.outfit);
        if (existing) existing.weeksLeft = def.wearWeeks;
        else c.outfits.push({ outfit: action.outfit, weeksLeft: def.wearWeeks });
        break;
      }

      case "sell": {
        if (c.location !== "flipIt") {
          err(i, "err.sell.wrongLocation");
          break;
        }
        const idx = c.items.indexOf(action.item);
        if (idx === -1) {
          err(i, "err.sell.notOwned");
          break;
        }
        const def = ITEMS.find((it) => it.id === action.item);
        if (!def) {
          err(i, "err.sell.unknownItem");
          break;
        }
        if (!spendTU(SHOP.buyTU)) break;
        c.items.splice(idx, 1);
        c.cash += Math.floor((def.price * SHOP.sellPct) / 100);
        break;
      }

      case "eat": {
        if (c.ate) {
          err(i, "err.eat.alreadyAte");
          break;
        }
        if (action.kind === "basic") {
          if (c.location !== "quickMart") {
            err(i, "err.eat.wrongLocation", { location: "quickMart" });
            break;
          }
          if (!spendCash(FOOD.basicCost)) break;
          if (!spendTU(FOOD.eatTU)) break;
        } else if (action.kind === "bulk") {
          if (c.location !== "quickMart") {
            err(i, "err.eat.wrongLocation", { location: "quickMart" });
            break;
          }
          if (!c.items.includes("fridge")) {
            err(i, "err.eat.needFridge");
            break;
          }
          if (!spendCash(FOOD.bulkCost)) break;
          if (!spendTU(FOOD.eatTU)) break;
          c.bulkFoodWeeks += FOOD.bulkWeeks;
        } else {
          // delivery: only from home
          if (c.location !== "home") {
            err(i, "err.eat.wrongLocation", { location: "home" });
            break;
          }
          if (!spendCash(FOOD.deliveryCost)) break;
          if (!spendTU(FOOD.eatTU)) break;
        }
        c.ate = true;
        break;
      }

      case "bank": {
        if (c.location !== "bank") {
          err(i, "err.bank.wrongLocation");
          break;
        }
        if (!Number.isInteger(action.amount) || action.amount <= 0) {
          err(i, "err.bank.badAmount");
          break;
        }
        if (action.op === "deposit") {
          if (action.amount > c.cash) {
            err(i, "err.cash.insufficient", { need: action.amount, have: c.cash });
            break;
          }
          if (!spendTU(BANK.bankTU)) break;
          c.cash -= action.amount;
          c.bankBalance += action.amount;
        } else {
          if (action.amount > c.bankBalance) {
            err(i, "err.bank.insufficientBalance");
            break;
          }
          if (!spendTU(BANK.bankTU)) break;
          c.bankBalance -= action.amount;
          c.cash += action.amount;
        }
        break;
      }

      case "crypto": {
        if (c.location !== "bank") {
          err(i, "err.bank.wrongLocation");
          break;
        }
        if (!Number.isInteger(action.amount) || action.amount <= 0) {
          err(i, "err.bank.badAmount");
          break;
        }
        if (action.op === "buy") {
          if (action.amount > c.cash) {
            err(i, "err.cash.insufficient", { need: action.amount, have: c.cash });
            break;
          }
          if (!spendTU(CRYPTO.tradeTU)) break;
          c.cash -= action.amount;
          c.cryptoUnits += action.amount / state.cryptoPrice;
        } else {
          const value = c.cryptoUnits * state.cryptoPrice;
          if (action.amount > Math.floor(value)) {
            err(i, "err.crypto.insufficientUnits");
            break;
          }
          if (!spendTU(CRYPTO.tradeTU)) break;
          c.cryptoUnits -= action.amount / state.cryptoPrice;
          c.cash += action.amount;
        }
        break;
      }

      case "lottery": {
        if (c.location !== "quickMart") {
          err(i, "err.lottery.wrongLocation");
          break;
        }
        if (
          !Number.isInteger(action.tickets) ||
          action.tickets <= 0 ||
          c.lotteryTickets + action.tickets > LOTTERY.maxTicketsPerWeek
        ) {
          err(i, "err.lottery.badCount", { max: LOTTERY.maxTicketsPerWeek });
          break;
        }
        if (!spendCash(action.tickets * LOTTERY.ticketCost)) break;
        if (!spendTU(LOTTERY.buyTU)) break;
        c.lotteryTickets += action.tickets;
        break;
      }

      case "fun": {
        const def = FUN[action.kind];
        if (c.location !== def.location) {
          err(i, "err.fun.wrongLocation", { location: def.location });
          break;
        }
        if (!spendCash(def.cost)) break;
        if (!spendTU(def.tu)) break;
        break;
      }

      case "payRent": {
        if (c.location !== "rentALord") {
          err(i, "err.rent.wrongLocation");
          break;
        }
        if (c.evicted) {
          err(i, "err.rent.evicted");
          break;
        }
        if (c.rentPaid) {
          err(i, "err.rent.alreadyPaid");
          break;
        }
        const rent = currentRent(state, player);
        if (!spendCash(rent)) break;
        if (!spendTU(BANK.bankTU)) break;
        c.rentPaid = true;
        break;
      }

      case "moveApartment": {
        if (c.location !== "rentALord") {
          err(i, "err.rent.wrongLocation");
          break;
        }
        const housing = HOUSING[action.tier];
        if (!housing) {
          err(i, "err.move.badTier");
          break;
        }
        if (!c.evicted && action.tier === c.housingTier) {
          err(i, "err.move.samePlace");
          break;
        }
        const deposit = Math.round(
          housing.rentPerWeek * state.rentMultiplier * RENT.depositWeeks
        );
        if (!spendCash(deposit)) break;
        if (!spendTU(RENT.moveTU)) break;
        c.housingTier = action.tier;
        c.evicted = false;
        break;
      }

      case "applyJob": {
        const job = JOBS.find((j) => j.tier === action.tier);
        if (!job) {
          err(i, "err.job.unknown");
          break;
        }
        const applyAt = job.requirements.applyAt;
        if (applyAt && c.location !== applyAt) {
          err(i, "err.apply.wrongLocation", { location: applyAt });
          break;
        }
        const reqError = meetsJobRequirements(state, player, c, action.tier);
        if (reqError) {
          err(i, reqError);
          break;
        }
        if (!spendTU(BANK.bankTU)) break;
        c.jobTier = action.tier;
        break;
      }

      case "rest": {
        if (!Number.isInteger(action.tu) || action.tu <= 0) {
          err(i, "err.rest.badAmount");
          break;
        }
        spendTU(action.tu);
        break;
      }

      default: {
        err(i, "err.action.unknown");
      }
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    projected: {
      tuUsed: c.tuUsed,
      cash: c.cash,
      location: c.location
    }
  };
}
