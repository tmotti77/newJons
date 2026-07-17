import { describe, expect, it } from "vitest";
import { EVENTS } from "../config/balance";
import { rollGlobalEvents, rollPersonalEvents } from "../events";
import { initialGameState } from "../state";

describe("rollGlobalEvents", () => {
  it("is deterministic for the same state", () => {
    const state = initialGameState(123, 2);
    const a = rollGlobalEvents(state);
    const b = rollGlobalEvents(state);
    expect(a.newCryptoPrice).toBe(b.newCryptoPrice);
    expect(a.newRentMultiplier).toBe(b.newRentMultiplier);
    expect(a.recession).toBe(b.recession);
    expect(a.cards.map((c) => c.id)).toEqual(b.cards.map((c) => c.id));
  });

  it("crypto price never goes below the floor", () => {
    let state = initialGameState(7, 1);
    for (let w = 0; w < 100; w++) {
      const g = rollGlobalEvents(state);
      expect(g.newCryptoPrice).toBeGreaterThanOrEqual(5);
      state = { ...state, week: state.week + 1, cryptoPrice: g.newCryptoPrice };
    }
  });

  it("rent hikes on schedule", () => {
    const state = initialGameState(7, 1);
    state.week = 4;
    const g = rollGlobalEvents(state);
    expect(g.newRentMultiplier).toBeGreaterThan(state.rentMultiplier * 1.04);
  });
});

describe("rollPersonalEvents", () => {
  it("is deterministic per (seed, week, slot)", () => {
    const state = initialGameState(55, 2);
    const ctx = { cashOnHand: 1000, workedTU: 20, wasHungryLastWeek: false, recession: false };
    const a = rollPersonalEvents(state, 0, ctx);
    const b = rollPersonalEvents(state, 0, ctx);
    expect(a).toEqual(b);
  });

  it("different players get different luck", () => {
    const state = initialGameState(55, 2);
    const ctx = { cashOnHand: 1000, workedTU: 20, wasHungryLastWeek: false, recession: false };
    const results = [rollPersonalEvents(state, 0, ctx), rollPersonalEvents(state, 1, ctx)];
    // Not guaranteed different every seed, but the streams must be independent:
    // check across many weeks that outcomes diverge at least once.
    let diverged = JSON.stringify(results[0]) !== JSON.stringify(results[1]);
    for (let w = 2; w <= 20 && !diverged; w++) {
      const s = { ...state, week: w };
      diverged =
        JSON.stringify(rollPersonalEvents(s, 0, ctx)) !==
        JSON.stringify(rollPersonalEvents(s, 1, ctx));
    }
    expect(diverged).toBe(true);
  });

  it("robbery only triggers above the cash threshold", () => {
    const state = initialGameState(55, 1);
    for (let w = 1; w <= 50; w++) {
      const s = { ...state, week: w };
      const r = rollPersonalEvents(s, 0, {
        cashOnHand: EVENTS.robbery.cashThreshold, // not above → never robbed
        workedTU: 0,
        wasHungryLastWeek: false,
        recession: false
      });
      expect(r.cards.some((c) => c.key === "event.robbery")).toBe(false);
    }
  });

  it("caps personal event cards per week", () => {
    const state = initialGameState(55, 1);
    for (let w = 1; w <= 100; w++) {
      const s = { ...state, week: w };
      const r = rollPersonalEvents(s, 0, {
        cashOnHand: 10000,
        workedTU: 40,
        wasHungryLastWeek: true,
        recession: true
      });
      expect(r.cards.length).toBeLessThanOrEqual(EVENTS.maxPersonalEventsPerPlayerPerWeek);
    }
  });
});
