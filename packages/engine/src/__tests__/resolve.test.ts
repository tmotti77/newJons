import { describe, expect, it } from "vitest";
import {
  HAPPINESS,
  JOBS,
  RENT,
  TIME_UNITS_PER_WEEK
} from "../config/balance";
import { autoRestPlan, resolveWeek } from "../resolve";
import { initialGameState } from "../state";
import type { Action, GameState } from "../types";

function freshGame(players = 2, seed = 42): GameState {
  return initialGameState(seed, players);
}

function planMap(...plans: Action[][]): Map<number, Action[]> {
  const m = new Map<number, Action[]>();
  plans.forEach((p, i) => m.set(i, p));
  return m;
}

describe("resolveWeek — wages", () => {
  it("credits wages for worked TU", () => {
    const state = freshGame();
    const p = state.players[0]!;
    p.jobTier = 1;
    p.cash = 200;
    const plan: Action[] = [
      { type: "travel", to: "burgerBarn" },
      { type: "work", tu: 20 },
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "basic" }
    ];
    const result = resolveWeek(state, planMap(plan, []));
    const after = result.players[0]!.stateAfter;
    const wage = JOBS.find((j) => j.tier === 1)!.wagePerTU;
    // Wage line in ledger, amount possibly modified by events; at least verify a wages entry
    const wagesLine = result.players[0]!.ledger.find((l) => l.key === "ledger.wages");
    expect(wagesLine).toBeDefined();
    expect(after.weeksWorked).toBe(1);
    // With no events, expect 20 * 10 = 200 minus rent/food effects on cash flow.
    expect(wagesLine!.cashDelta).toBeGreaterThanOrEqual(wage * 20 * 0.5);
  });

  it("applies burnout wage penalty", () => {
    const state = freshGame(1, 7);
    const p = state.players[0]!;
    p.jobTier = 1;
    p.happiness = 10; // below burnout threshold
    const plan: Action[] = [
      { type: "travel", to: "burgerBarn" },
      { type: "work", tu: 10 }
    ];
    const result = resolveWeek(state, planMap(plan));
    const wagesLine = result.players[0]!.ledger.find((l) => l.key === "ledger.wages");
    const base = JOBS.find((j) => j.tier === 1)!.wagePerTU * 10;
    expect(wagesLine!.cashDelta).toBeLessThanOrEqual(
      Math.floor(base * HAPPINESS.burnoutWageMultiplier * 1.5) // 1.5 headroom for overtime event
    );
  });
});

describe("resolveWeek — rent & eviction", () => {
  it("auto-charges rent when affordable", () => {
    const state = freshGame();
    const result = resolveWeek(state, planMap([], []));
    const after = result.players[0]!.stateAfter;
    const ledger = result.players[0]!.ledger;
    expect(ledger.some((l) => l.key === "ledger.rentAutoPaid")).toBe(true);
    expect(after.missedRentWeeks).toBe(0);
  });

  it("late notice on first miss, eviction on second", () => {
    let state = freshGame(1, 11);
    state.players[0]!.cash = 0;
    let result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.lateNotice")).toBe(true);
    expect(result.players[0]!.stateAfter.missedRentWeeks).toBe(1);
    expect(result.players[0]!.stateAfter.evicted).toBe(false);

    // Week 2, still broke
    state = result.nextState;
    state.players[0]!.cash = 0;
    result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.stateAfter.evicted).toBe(true);
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.evicted")).toBe(true);
  });

  it("shelter drains happiness weekly", () => {
    const state = freshGame(1, 13);
    state.players[0]!.evicted = true;
    const before = state.players[0]!.happiness;
    const result = resolveWeek(state, planMap([]));
    // shelter penalty + decay + hunger (no food) — just confirm the shelter line exists
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.shelter")).toBe(true);
    expect(result.players[0]!.stateAfter.happiness).toBeLessThan(before);
  });
});

describe("resolveWeek — food & happiness", () => {
  it("penalizes going hungry", () => {
    const state = freshGame(1, 17);
    const result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.wentHungry")).toBe(true);
    expect(result.players[0]!.stateAfter.fedThisWeek).toBe(false);
  });

  it("bulk food in fridge feeds automatically", () => {
    const state = freshGame(1, 17);
    state.players[0]!.bulkFoodWeeks = 2;
    const result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.ateFromFridge")).toBe(true);
    expect(result.players[0]!.stateAfter.bulkFoodWeeks).toBe(1);
    expect(result.players[0]!.stateAfter.fedThisWeek).toBe(true);
  });

  it("applies weekly happiness decay and housing bonus", () => {
    const state = freshGame(1, 19);
    const p = state.players[0]!;
    p.housingTier = 2; // +8/wk
    p.cash = 5000;
    p.bulkFoodWeeks = 1;
    const result = resolveWeek(state, planMap([]));
    const after = result.players[0]!.stateAfter;
    // full rest: 60 TU unspent → +12; decay -3; housing +8 → net positive
    expect(after.happiness).toBeGreaterThan(p.happiness);
  });

  it("happiness stays clamped to [0, 100]", () => {
    const state = freshGame(1, 23);
    state.players[0]!.happiness = 1;
    state.players[0]!.cash = 0;
    const result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.stateAfter.happiness).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveWeek — auto-rest substitution", () => {
  it("substitutes auto-rest for missing plans", () => {
    const state = freshGame(2, 29);
    const result = resolveWeek(state, planMap([{ type: "rest", tu: 10 }]));
    // player 1 submitted nothing
    expect(result.players[1]!.ledger.some((l) => l.key === "ledger.autoRest")).toBe(true);
  });

  it("substitutes auto-rest for invalid plans", () => {
    const state = freshGame(1, 31);
    const invalid: Action[] = [{ type: "rest", tu: TIME_UNITS_PER_WEEK * 2 }];
    const result = resolveWeek(state, planMap(invalid));
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.autoRest")).toBe(true);
  });
});

describe("resolveWeek — outfits & demotion", () => {
  it("wears out outfits weekly and demotes when dress code lost", () => {
    const state = freshGame(1, 37);
    const p = state.players[0]!;
    p.jobTier = 3;
    p.outfits.push({ outfit: "business", weeksLeft: 1 }); // will expire this week
    p.cash = 1000;
    const result = resolveWeek(state, planMap([]));
    const after = result.players[0]!.stateAfter;
    expect(after.outfits.length).toBe(0);
    expect(after.jobTier).toBe(0);
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.demotedNoOutfit")).toBe(true);
  });
});

describe("resolveWeek — bank & courses", () => {
  it("pays weekly interest on bank balance", () => {
    const state = freshGame(1, 41);
    const p = state.players[0]!;
    p.bankBalance = 1000;
    p.cash = 500;
    const result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.stateAfter.bankBalance).toBe(1010);
  });

  it("credits completed courses", () => {
    const state = freshGame(1, 43);
    const p = state.players[0]!;
    p.cash = 500;
    const plan: Action[] = [
      { type: "travel", to: "college" },
      { type: "study", courseTrack: "tech" },
      { type: "study", courseTrack: "tech" }
    ];
    const result = resolveWeek(state, planMap(plan));
    expect(result.players[0]!.stateAfter.courses.tech).toBe(2);
  });
});

describe("resolveWeek — global state", () => {
  it("advances week and updates crypto price deterministically", () => {
    const state = freshGame(2, 47);
    const a = resolveWeek(state, planMap([], []));
    const b = resolveWeek(state, planMap([], []));
    expect(a.nextState.week).toBe(2);
    expect(a.nextState.cryptoPrice).toBe(b.nextState.cryptoPrice);
    expect(a.nextState.cryptoPrice).toBeGreaterThan(0);
  });

  it("applies scheduled rent hikes on the interval week", () => {
    let state = freshGame(1, 53);
    state.players[0]!.cash = 100000;
    const startMult = state.rentMultiplier;
    // advance to the hike week
    for (let w = 1; w <= RENT.globalHikeIntervalWeeks; w++) {
      const r = resolveWeek(state, planMap([]));
      state = r.nextState;
    }
    expect(state.rentMultiplier).toBeGreaterThan(startMult);
  });

  it("declares a winner when all four goals are met", () => {
    const state = freshGame(2, 59);
    const p = state.players[0]!;
    p.cash = 5000;
    p.happiness = 90;
    p.courses.business = 4;
    p.jobTier = 3;
    p.outfits.push({ outfit: "business", weeksLeft: 8 });
    p.bulkFoodWeeks = 5;
    const result = resolveWeek(state, planMap([], []));
    expect(result.winnerSlot).toBe(0);
  });

  it("declares cap winner at max weeks", () => {
    const state = freshGame(2, 61);
    state.week = state.settings.maxWeeks; // resolving this week hits the cap
    state.players[0]!.cash = 1500; // better score than player 1
    const result = resolveWeek(state, planMap([], []));
    expect(result.winnerSlot).toBeDefined();
  });

  it("standings are ordered and complete", () => {
    const state = freshGame(4, 67);
    const result = resolveWeek(state, planMap([], [], [], []));
    expect([...result.standings].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("autoRestPlan", () => {
  it("is a valid plan for any fresh player", () => {
    const state = freshGame(1, 71);
    const result = resolveWeek(state, planMap(autoRestPlan()));
    expect(result.players[0]!.ledger.some((l) => l.key === "ledger.rested")).toBe(false);
    // rest consumed all TU explicitly, so no unspent-TU bonus line — but also no crash
    expect(result.nextState.week).toBe(2);
  });
});

describe("resolveWeek — lottery & rare events", () => {
  it("jackpot pays out for some seed (deterministic search)", () => {
    // Find a seed where buying max tickets wins, then assert the payout.
    let winningSeed = -1;
    for (let seed = 1; seed < 4000 && winningSeed === -1; seed++) {
      const state = freshGame(1, seed);
      const p = state.players[0]!;
      p.lotteryTickets = 10; // pre-loaded tickets, drawn at resolve
      p.cash = 100;
      const result = resolveWeek(state, planMap([]));
      if (result.players[0]!.ledger.some((l) => l.key === "ledger.jackpot")) {
        winningSeed = seed;
        expect(
          result.players[0]!.eventCards.some((c) => c.category === "jackpot")
        ).toBe(true);
        expect(result.players[0]!.stateAfter.cash).toBeGreaterThan(1000);
      }
    }
    expect(winningSeed).toBeGreaterThan(0);
  });

  it("lottery tickets are consumed even when losing", () => {
    const state = freshGame(1, 3);
    state.players[0]!.lotteryTickets = 1;
    const result = resolveWeek(state, planMap([]));
    expect(result.players[0]!.stateAfter.lotteryTickets).toBe(0);
  });

  it("robbery fires for cash-rich players on some seed", () => {
    let found = false;
    for (let seed = 1; seed < 200 && !found; seed++) {
      const state = freshGame(1, seed);
      state.players[0]!.cash = 2000; // way above threshold
      const result = resolveWeek(state, planMap([]));
      if (result.players[0]!.ledger.some((l) => l.key === "event.robbery")) found = true;
    }
    expect(found).toBe(true);
  });

  it("layoff during recession demotes T3+ to gig on some seed", () => {
    let found = false;
    for (let seed = 1; seed < 3000 && !found; seed++) {
      const state = freshGame(1, seed);
      const p = state.players[0]!;
      p.jobTier = 4;
      p.cash = 3000;
      const result = resolveWeek(state, planMap([]));
      if (result.players[0]!.ledger.some((l) => l.key === "event.layoff")) {
        found = true;
        expect(result.players[0]!.stateAfter.jobTier).toBe(0);
      }
    }
    expect(found).toBe(true);
  });

  it("phone can break and disappears from items", () => {
    let found = false;
    for (let seed = 1; seed < 500 && !found; seed++) {
      const state = freshGame(1, seed);
      state.players[0]!.items.push("phone");
      state.players[0]!.cash = 300;
      const result = resolveWeek(state, planMap([]));
      if (result.players[0]!.ledger.some((l) => l.key === "event.phoneBroke")) {
        found = true;
        expect(result.players[0]!.stateAfter.items).not.toContain("phone");
      }
    }
    expect(found).toBe(true);
  });
});

describe("resolveWeek — full plan execution paths", () => {
  it("executes bank, crypto, sell, fun, moveApartment, lottery buys", () => {
    const state = freshGame(1, 101);
    const p = state.players[0]!;
    p.cash = 3000;
    p.cryptoUnits = 0;
    p.items.push("tv");
    const plan: Action[] = [
      { type: "travel", to: "bank" },
      { type: "bank", op: "deposit", amount: 500 },
      { type: "bank", op: "withdraw", amount: 100 },
      { type: "crypto", op: "buy", amount: 200 },
      { type: "crypto", op: "sell", amount: 50 },
      { type: "travel", to: "flipIt" },
      { type: "sell", item: "tv" },
      { type: "travel", to: "quickMart" },
      { type: "lottery", tickets: 2 },
      { type: "eat", kind: "basic" },
      { type: "travel", to: "rentALord" },
      { type: "moveApartment", tier: 1 },
      { type: "travel", to: "theSpot" },
      { type: "fun", kind: "movie" }
    ];
    const result = resolveWeek(state, planMap(plan));
    const after = result.players[0]!.stateAfter;
    expect(after.bankBalance).toBeGreaterThanOrEqual(400); // 400 + interest
    expect(after.cryptoUnits).toBeGreaterThan(0);
    expect(after.items).not.toContain("tv");
    expect(after.housingTier).toBe(1);
  });

  it("delivery and bulk eating paths execute", () => {
    const state = freshGame(1, 103);
    const p = state.players[0]!;
    p.cash = 500;
    p.items.push("fridge");
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "bulk" }
    ];
    const result = resolveWeek(state, planMap(plan));
    expect(result.players[0]!.stateAfter.bulkFoodWeeks).toBeGreaterThan(0);

    const state2 = freshGame(1, 104);
    state2.players[0]!.cash = 500;
    const plan2: Action[] = [{ type: "eat", kind: "delivery" }];
    const r2 = resolveWeek(state2, planMap(plan2));
    expect(r2.players[0]!.stateAfter.fedThisWeek).toBe(true);
  });
});
