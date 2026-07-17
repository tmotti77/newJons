/**
 * Bot regression: the greedy bot must be able to FINISH games on every
 * preset. This doubles as an end-to-end engine exercise (promotions,
 * outfits wearing out, rent hikes, events) and guards balance changes —
 * if a preset becomes unwinnable, this fails.
 */
import { describe, expect, it } from "vitest";
import { greedyPlan } from "../bots/greedy";
import { GOAL_PRESETS } from "../config/balance";
import { resolveWeek } from "../resolve";
import { initialGameState } from "../state";
import type { Action, GameState } from "../types";

function playToWin(preset: keyof typeof GOAL_PRESETS, seed: number, cap: number): number {
  let state: GameState = initialGameState(seed, 4, {
    goals: { ...GOAL_PRESETS[preset] },
    maxWeeks: cap + 10,
    planTimerSeconds: 90
  });
  for (let w = 1; w <= cap; w++) {
    const plans = new Map<number, Action[]>();
    for (let s = 0; s < 4; s++) plans.set(s, greedyPlan(state, s));
    const result = resolveWeek(state, plans);
    if (result.players.some((p) => p.goalProgress.achievedAll)) return w;
    state = result.nextState;
  }
  return -1;
}

describe("greedy bot", () => {
  it("always returns a valid non-empty plan", () => {
    const state = initialGameState(3, 2);
    const plan = greedyPlan(state, 0);
    expect(plan.length).toBeGreaterThan(0);
  });

  it("returns rest plan for unknown slots", () => {
    const state = initialGameState(3, 1);
    expect(greedyPlan(state, 5)).toEqual([{ type: "rest", tu: 60 }]);
  });

  it("finishes Quick games in 10–14 weeks (balance target)", () => {
    const weeks = [1, 2, 3, 4, 5].map((s) => playToWin("quick", s * 1009, 30));
    for (const w of weeks) {
      expect(w).toBeGreaterThanOrEqual(8);
      expect(w).toBeLessThanOrEqual(16);
    }
  });

  it("finishes Classic games within 25 weeks", () => {
    const w = playToWin("classic", 4242, 40);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(25);
  });

  it("finishes Marathon games within 40 weeks", () => {
    const w = playToWin("marathon", 777, 50);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(40);
  });
});
