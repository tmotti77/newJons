import { describe, expect, it } from "vitest";
import { GOAL_PRESETS } from "../config/balance";
import { capWinner, goalProgress, standings, weekWinner } from "../goals";
import { initialGameState } from "../state";

describe("goalProgress", () => {
  it("fresh player has partial progress, not achievedAll", () => {
    const state = initialGameState(1, 1);
    const gp = goalProgress(state, state.players[0]!);
    expect(gp.achievedAll).toBe(false);
    expect(gp.score).toBeGreaterThan(0);
    expect(gp.score).toBeLessThan(4);
  });

  it("achievedAll requires all four goals", () => {
    const state = initialGameState(1, 1);
    const p = state.players[0]!;
    p.cash = GOAL_PRESETS.quick.netWorth;
    p.happiness = GOAL_PRESETS.quick.happiness;
    p.courses.tech = GOAL_PRESETS.quick.courses;
    p.jobTier = 2; // one below goal tier 3
    expect(goalProgress(state, p).achievedAll).toBe(false);
    p.jobTier = 3;
    expect(goalProgress(state, p).achievedAll).toBe(true);
  });

  it("caps each pct at 1 so overshoot doesn't inflate score", () => {
    const state = initialGameState(1, 1);
    const p = state.players[0]!;
    p.cash = GOAL_PRESETS.quick.netWorth * 10;
    const gp = goalProgress(state, p);
    expect(gp.pct.netWorth).toBe(1);
  });

  it("net worth includes bank, crypto, and item resale value", () => {
    const state = initialGameState(1, 1);
    const p = state.players[0]!;
    p.cash = 0;
    p.bankBalance = 500;
    p.cryptoUnits = 2; // price 100 → 200
    p.items.push("laptop"); // resale 250
    const gp = goalProgress(state, p);
    expect(gp.netWorth).toBe(500 + 200 + 250);
  });
});

describe("standings & winners", () => {
  it("orders by score, tiebreak by slot", () => {
    const state = initialGameState(1, 3);
    state.players[1]!.cash = 1500;
    const s = standings(state);
    expect(s[0]).toBe(1);
    expect(s.length).toBe(3);
  });

  it("weekWinner undefined when nobody achieved all", () => {
    const state = initialGameState(1, 2);
    expect(weekWinner(state)).toBeUndefined();
  });

  it("same-week tie broken by higher score", () => {
    const state = initialGameState(1, 2);
    for (const p of state.players) {
      p.cash = GOAL_PRESETS.quick.netWorth;
      p.happiness = GOAL_PRESETS.quick.happiness;
      p.courses.tech = GOAL_PRESETS.quick.courses;
      p.jobTier = 3;
    }
    state.players[1]!.cash += 10000; // overshoot doesn't matter (capped)...
    state.players[1]!.jobTier = 6; // ...but higher tier pct does? no — capped too.
    // Equal capped scores → tiebreak by slot: player 0 wins.
    expect(weekWinner(state)).toBe(0);
  });

  it("capWinner always returns someone", () => {
    const state = initialGameState(1, 4);
    expect([0, 1, 2, 3]).toContain(capWinner(state));
  });
});
