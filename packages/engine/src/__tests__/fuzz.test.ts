/**
 * Fuzz suite (DEV_PLAN Phase 1): random plans must never crash the engine,
 * never produce negative cash, and keep all resources in bounds.
 */
import { describe, expect, it } from "vitest";
import { HAPPINESS } from "../config/balance";
import { mulberry32 } from "../rng";
import { resolveWeek } from "../resolve";
import { initialGameState } from "../state";
import type { Action, GameState } from "../types";
import { validatePlan } from "../validate";
import { randomPlan } from "./determinism.test";

describe("fuzz: random plans", () => {
  it("validatePlan never throws on garbage plans", () => {
    const rng = mulberry32(31337);
    const state = initialGameState(31337, 4);
    for (let i = 0; i < 5000; i++) {
      const slot = Math.floor(rng() * 4);
      expect(() => validatePlan(state, slot, randomPlan(rng))).not.toThrow();
    }
  });

  it("full games with random plans keep invariants", () => {
    const rng = mulberry32(4242);
    for (let g = 0; g < 30; g++) {
      const players = 2 + (g % 7);
      let state: GameState = initialGameState(g * 31 + 7, players);
      for (let w = 0; w < 30; w++) {
        const plans = new Map<number, Action[]>();
        for (let s = 0; s < players; s++) {
          if (rng() < 0.8) plans.set(s, randomPlan(rng)); // 20%: no submission
        }
        const result = resolveWeek(state, plans);
        for (const pr of result.players) {
          const p = pr.stateAfter;
          expect(p.cash).toBeGreaterThanOrEqual(0);
          expect(p.bankBalance).toBeGreaterThanOrEqual(0);
          expect(p.cryptoUnits).toBeGreaterThanOrEqual(0);
          expect(p.happiness).toBeGreaterThanOrEqual(HAPPINESS.min);
          expect(p.happiness).toBeLessThanOrEqual(HAPPINESS.max);
          expect(p.courses.business).toBeGreaterThanOrEqual(0);
          expect(p.jobTier).toBeGreaterThanOrEqual(-1);
          expect(p.jobTier).toBeLessThanOrEqual(6);
          expect(p.housingTier).toBeGreaterThanOrEqual(0);
          expect(p.housingTier).toBeLessThanOrEqual(2);
          // no duplicate unique items
          expect(new Set(p.items).size).toBe(p.items.length);
        }
        expect(result.nextState.cryptoPrice).toBeGreaterThan(0);
        expect(result.nextState.rentMultiplier).toBeGreaterThanOrEqual(1);
        state = result.nextState;
      }
    }
  });

  it("plans submitted for wrong slots are ignored gracefully", () => {
    const state = initialGameState(99, 2);
    const plans = new Map<number, Action[]>();
    plans.set(7, [{ type: "rest", tu: 10 }]); // slot 7 doesn't exist
    expect(() => resolveWeek(state, plans)).not.toThrow();
  });
});
