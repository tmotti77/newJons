/**
 * Seeded PRNG (mulberry32) — the ONLY source of randomness in the engine
 * (DEV_PLAN §3.3). All randomness flows from the per-game seed + round
 * number + lane; never Math.random().
 */

export type Rng = () => number;

/** mulberry32: fast, decent-quality 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a deterministic stream for (gameSeed, week, lane).
 * lane: playerSlot for per-player rolls, or GLOBAL_LANE for shared rolls
 * (crypto price, rent heat, recession).
 */
export const GLOBAL_LANE = 999;

export function rngFor(gameSeed: number, week: number, lane: number): Rng {
  // Mix the three inputs into one 32-bit seed. Constants are arbitrary
  // odd primes; stability of this function is part of the save format.
  let h = gameSeed >>> 0;
  h = Math.imul(h ^ (week + 0x9e3779b9), 0x85ebca6b);
  h = Math.imul(h ^ (lane + 0xc2b2ae35), 0x27d4eb2f);
  h ^= h >>> 16;
  return mulberry32(h);
}

/** Roll a percentage chance [0..100]. */
export function chance(rng: Rng, pct: number): boolean {
  return rng() * 100 < pct;
}

/** Integer in [min, max] inclusive. */
export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Uniform float in [-range, +range]. */
export function symmetric(rng: Rng, range: number): number {
  return (rng() * 2 - 1) * range;
}

/** Pick one element by weight. Weights must be positive. */
export function weightedPick<T>(rng: Rng, entries: ReadonlyArray<[T, number]>): T {
  let total = 0;
  for (const [, w] of entries) total += w;
  let roll = rng() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  // Floating-point edge: return last.
  const last = entries[entries.length - 1];
  if (!last) throw new Error("weightedPick: empty entries");
  return last[0];
}
