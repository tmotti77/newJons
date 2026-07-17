import { describe, expect, it } from "vitest";
import { GLOBAL_LANE, chance, intBetween, mulberry32, rngFor, symmetric, weightedPick } from "../rng";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it("produces different streams for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const same = Array.from({ length: 100 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(5);
  });

  it("stays in [0, 1)", () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rngFor lanes", () => {
  it("same (seed, week, lane) → identical stream", () => {
    const a = rngFor(999, 3, 1);
    const b = rngFor(999, 3, 1);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("different lanes are independent", () => {
    const a = rngFor(999, 3, 0);
    const b = rngFor(999, 3, 1);
    expect(a()).not.toBe(b());
  });

  it("different weeks are independent", () => {
    const a = rngFor(999, 1, GLOBAL_LANE);
    const b = rngFor(999, 2, GLOBAL_LANE);
    expect(a()).not.toBe(b());
  });
});

describe("helpers", () => {
  it("chance(100) always true, chance(0) always false", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      expect(chance(rng, 100)).toBe(true);
      expect(chance(rng, 0)).toBe(false);
    }
  });

  it("intBetween respects bounds", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = intBetween(rng, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it("symmetric stays within range", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = symmetric(rng, 40);
      expect(Math.abs(v)).toBeLessThanOrEqual(40);
    }
  });

  it("weightedPick honors weights roughly", () => {
    const rng = mulberry32(7);
    let aCount = 0;
    for (let i = 0; i < 10000; i++) {
      if (weightedPick(rng, [["a", 90], ["b", 10]]) === "a") aCount++;
    }
    expect(aCount).toBeGreaterThan(8500);
    expect(aCount).toBeLessThan(9500);
  });
});
