import { describe, expect, it } from "vitest";

import type { LocationId } from "@fastlane/engine";

import {
  LAYOUT,
  LOCATION_IDS,
  RING_LENGTH,
  ROAD,
  ROAD_HALF_WIDTH,
  pathLength,
  pointAt,
  resample,
  standPoint,
  toSvgPath,
  walkDurationMs,
  walkPath,
  type Pt
} from "../geometry";

/**
 * Signed distance to the road centreline, derived independently of the module's
 * own flattening code (standard rounded-box SDF) so the tests cross-check the
 * geometry rather than restating it. Negative = inside the loop.
 */
function signedDistToRoad(p: Pt): number {
  const cx = ROAD.x + ROAD.width / 2;
  const cy = ROAD.y + ROAD.height / 2;
  const qx = Math.abs(p.x - cx) - (ROAD.width / 2 - ROAD.rx);
  const qy = Math.abs(p.y - cy) - (ROAD.height / 2 - ROAD.rx);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - ROAD.rx;
}

const onRoad = (p: Pt) => Math.abs(signedDistToRoad(p)) <= ROAD_HALF_WIDTH + 1e-6;

const perimeter = LOCATION_IDS.filter((id) => id !== "theSpot");

const pairs: Array<[LocationId, LocationId]> = LOCATION_IDS.flatMap((a) =>
  LOCATION_IDS.map((b) => [a, b] as [LocationId, LocationId])
);

describe("walkPath endpoints", () => {
  it("starts and ends at the stand points for every pair", () => {
    for (const [from, to] of pairs) {
      const path = walkPath(from, to);
      const first = path[0]!;
      const last = path[path.length - 1]!;

      expect(first.x).toBeCloseTo(standPoint(from).x, 6);
      expect(first.y).toBeCloseTo(standPoint(from).y, 6);
      expect(last.x).toBeCloseTo(standPoint(to).x, 6);
      expect(last.y).toBeCloseTo(standPoint(to).y, 6);
    }
  });

  it("produces a single point when you are already there", () => {
    for (const id of LOCATION_IDS) expect(walkPath(id, id)).toHaveLength(1);
  });

  it("never produces NaN", () => {
    for (const [from, to] of pairs) {
      for (const p of walkPath(from, to)) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});

describe("no detours", () => {
  it("keeps same-column neighbours far shorter than a cross-town trip", () => {
    const neighbour = pathLength(walkPath("home", "burgerBarn"));
    const crossTown = pathLength(walkPath("home", "bank"));

    expect(neighbour).toBeLessThan(crossTown / 2);
    // "step out, walk down, step in" — not a lap of the town.
    expect(neighbour).toBeLessThan(RING_LENGTH / 4);
  });

  it("never walks more than half the ring plus the two stand steps", () => {
    for (const from of perimeter) {
      for (const to of perimeter) {
        expect(pathLength(walkPath(from, to))).toBeLessThanOrEqual(RING_LENGTH / 2 + 13);
      }
    }
  });

  it("is symmetric — there and back cost the same", () => {
    for (const [from, to] of pairs) {
      expect(pathLength(walkPath(from, to))).toBeCloseTo(pathLength(walkPath(to, from)), 6);
    }
  });
});

describe("stays on the road", () => {
  it("keeps every point of a perimeter trip on the tarmac", () => {
    for (const from of perimeter) {
      for (const to of perimeter) {
        for (const p of walkPath(from, to)) {
          expect(onRoad(p)).toBe(true);
        }
      }
    }
  });

  it("reaches the plaza by crossing the road", () => {
    for (const from of perimeter) {
      const path = walkPath(from, "theSpot");

      // Ends inside the loop, well off the road...
      expect(signedDistToRoad(path[path.length - 1]!)).toBeLessThan(-ROAD_HALF_WIDTH);
      // ...having actually walked on the road to get there.
      expect(path.some(onRoad)).toBe(true);
    }
  });
});

describe("pointAt", () => {
  it("is exact at both ends", () => {
    const path = walkPath("home", "bank");
    const total = pathLength(path);

    expect(pointAt(path, 0).x).toBeCloseTo(path[0]!.x, 6);
    expect(pointAt(path, 0).y).toBeCloseTo(path[0]!.y, 6);
    expect(pointAt(path, total).x).toBeCloseTo(path[path.length - 1]!.x, 6);
    expect(pointAt(path, total).y).toBeCloseTo(path[path.length - 1]!.y, 6);
  });

  it("clamps out-of-range distances instead of extrapolating", () => {
    const path = walkPath("home", "bank");
    const total = pathLength(path);

    expect(pointAt(path, -50)).toMatchObject({ x: path[0]!.x, y: path[0]!.y });
    expect(pointAt(path, total + 500).x).toBeCloseTo(path[path.length - 1]!.x, 6);
  });

  it("advances monotonically along the path", () => {
    const path = walkPath("home", "bank");
    const total = pathLength(path);
    let covered = 0;
    let prev = pointAt(path, 0);

    for (let i = 1; i <= 100; i++) {
      const next = pointAt(path, (total * i) / 100);
      covered += Math.hypot(next.x - prev.x, next.y - prev.y);
      prev = next;
    }

    // Sampling a path with arcs cuts corners, so the walked distance is always
    // a shade under the true length — never over, and never by much.
    expect(covered).toBeLessThanOrEqual(total + 1e-9);
    expect(covered).toBeGreaterThan(total * 0.99);
  });

  it("reports facing from the direction of travel", () => {
    // college (east, top) to home (west, top) travels leftward over the top arc.
    const west = walkPath("college", "home");
    expect(pointAt(west, pathLength(west) / 2).facing).toBe(-1);

    const east = walkPath("home", "college");
    expect(pointAt(east, pathLength(east) / 2).facing).toBe(1);
  });
});

describe("resample", () => {
  it("preserves path length at high sample counts", () => {
    for (const [from, to] of pairs) {
      if (from === to) continue;
      const path = walkPath(from, to);
      const exact = pathLength(path);
      const dense = pathLength(resample(path, 200));

      // Chord sampling can only shorten, and at 200 points loses well under 1%.
      expect(dense).toBeLessThanOrEqual(exact + 1e-9);
      expect(dense).toBeGreaterThan(exact * 0.99);
    }
  });

  it("returns exactly n points, endpoints included", () => {
    const path = walkPath("home", "theSpot");
    const out = resample(path, 24);

    expect(out).toHaveLength(24);
    expect(out[0]!.x).toBeCloseTo(path[0]!.x, 6);
    expect(out[23]!.x).toBeCloseTo(path[path.length - 1]!.x, 6);
  });

  it("handles a zero-length path without dividing by zero", () => {
    const out = resample(walkPath("home", "home"), 24);
    expect(out).toHaveLength(24);
    expect(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("rejects degenerate sample counts", () => {
    expect(() => resample(walkPath("home", "bank"), 1)).toThrow();
  });
});

describe("walkDurationMs", () => {
  it("clamps at both ends", () => {
    expect(walkDurationMs(0)).toBe(200);
    expect(walkDurationMs(100000)).toBe(700);
  });

  it("makes a cross-town trip visibly longer than a next-door hop", () => {
    const neighbour = walkDurationMs(pathLength(walkPath("home", "burgerBarn")));
    const crossTown = walkDurationMs(pathLength(walkPath("home", "bank")));
    expect(crossTown).toBeGreaterThan(neighbour);
  });
});

describe("purity", () => {
  it("returns identical paths on repeated calls", () => {
    for (const [from, to] of pairs) {
      expect(JSON.stringify(walkPath(from, to))).toBe(JSON.stringify(walkPath(from, to)));
    }
  });

  it("does not hand out mutable references to LAYOUT", () => {
    const before = { ...LAYOUT.home };
    const stand = standPoint("home");
    stand.x = 9999;
    expect(LAYOUT.home).toEqual(before);
  });
});

describe("toSvgPath", () => {
  it("emits a move followed by lines", () => {
    const d = toSvgPath(walkPath("home", "burgerBarn"));
    expect(d.startsWith("M ")).toBe(true);
    expect(d).toContain(" L ");
  });

  it("returns an empty string for an empty path", () => {
    expect(toSvgPath([])).toBe("");
  });
});
