import { describe, expect, it } from "vitest";
import { REVEAL } from "../config/balance";
import { pickRevealCards } from "../reveal";
import { resolveWeek } from "../resolve";
import { initialGameState } from "../state";
import type { Action, WeekResult } from "../types";

function planMap(...plans: Action[][]): Map<number, Action[]> {
  const m = new Map<number, Action[]>();
  plans.forEach((p, i) => m.set(i, p));
  return m;
}

/**
 * A deterministic week where slot 1 blows the most cash (buys a car + gadgets)
 * while slot 0 just rests. Slot 1 is unambiguously the biggest spender.
 */
function bigSpenderWeek(): WeekResult {
  const state = initialGameState(42, 2);
  state.players[1]!.cash = 3000;
  const spend: Action[] = [
    { type: "travel", to: "gadgetCity" },
    { type: "buy", item: "car" },
    { type: "buy", item: "console" },
    { type: "buy", item: "tv" }
  ];
  return resolveWeek(state, planMap([{ type: "rest", tu: 60 }], spend));
}

describe("pickRevealCards", () => {
  it("returns at most REVEAL.maxCards cards, globals before players", () => {
    const cards = pickRevealCards(bigSpenderWeek());
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(REVEAL.maxCards);
    const firstPlayer = cards.findIndex((c) => c.kind === "player");
    const lastGlobal = cards.map((c) => c.kind).lastIndexOf("global");
    if (firstPlayer !== -1 && lastGlobal !== -1) {
      expect(lastGlobal).toBeLessThan(firstPlayer);
    }
  });

  it("is deterministic for the same WeekResult", () => {
    const week = bigSpenderWeek();
    expect(pickRevealCards(week)).toEqual(pickRevealCards(week));
  });

  it("roasts the biggest cash spender by slot", () => {
    const cards = pickRevealCards(bigSpenderWeek());
    expect(
      cards.some((c) => c.kind === "player" && c.slot === 1 && c.i18nKey === "reveal.bigSpender")
    ).toBe(true);
  });

  it("emits no money/mood roast when swings are below the floor", () => {
    // Both players rest on a fresh state: tiny cash movement (just rent), so
    // no big-spender / top-earner card should clear the cash floor.
    const state = initialGameState(7, 2);
    const week = resolveWeek(
      state,
      planMap([{ type: "rest", tu: 60 }], [{ type: "rest", tu: 60 }])
    );
    const cards = pickRevealCards(week);
    expect(cards.some((c) => c.kind === "player" && c.i18nKey === "reveal.topEarner")).toBe(false);
    // rent (~80) is under the cash roast floor, so no big-spender card either.
    expect(REVEAL.cashRoastFloor).toBeGreaterThan(80);
    expect(cards.some((c) => c.kind === "player" && c.i18nKey === "reveal.bigSpender")).toBe(false);
  });
});
