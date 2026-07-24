/**
 * Town map geometry (§4.2) — the single owner of where things are on the map.
 *
 * Pure by construction: no React, no React Native, no engine *runtime* import
 * (`LocationId` is type-only), so this runs under plain node in vitest.
 *
 * The player walks a closed RING — the road centreline pushed 8px outward — so
 * the character hugs the storefronts instead of straddling the lane dashes.
 * `theSpot` sits inside the loop and is reached by a crosswalk spur.
 */
import type { LocationId } from "@fastlane/engine";

export type Pt = { x: number; y: number };

/**
 * The map is authored against this fixed design canvas and scaled to fit.
 * Shorter than wide-enough: columns are inset from the edges so the name pills
 * have room, and the whole thing is kept short enough to sit under the status
 * panel without dominating the screen.
 */
export const W = 360;
export const H = 500;
export const BUILDING_SIZE = 54;

/** The road as drawn (stroke width 34, so it reaches ±17 from the centreline). */
export const ROAD = { x: 108, y: 66, width: 144, height: 372, rx: 72 } as const;
export const ROAD_HALF_WIDTH = 17;

/**
 * West zone on the left, east zone on the right, theSpot as a central plaza
 * inside the loop — a legible composition, not a scatter. Columns sit just
 * outside the road walls (x=60 / x=300), leaving ~22px of margin for labels.
 */
export const LAYOUT: Record<LocationId, Pt> = {
  home: { x: 60, y: 74 },
  burgerBarn: { x: 60, y: 146 },
  quickMart: { x: 60, y: 218 },
  rentALord: { x: 60, y: 290 },
  flipIt: { x: 60, y: 362 },
  dressCode: { x: 60, y: 434 },
  college: { x: 300, y: 74 },
  gadgetCity: { x: 300, y: 194 },
  careerHub: { x: 300, y: 314 },
  bank: { x: 300, y: 434 },
  theSpot: { x: 180, y: 252 }
};

export const LOCATION_IDS = Object.keys(LAYOUT) as LocationId[];

/**
 * How far outside the road centreline the walk ring sits, and how far the
 * character then steps off the ring toward the door it is standing at.
 * RING_OFFSET + STAND_NUDGE must stay under ROAD_HALF_WIDTH or the character
 * walks off the tarmac.
 */
const RING_OFFSET = 8;
const STAND_NUDGE = 6;

const RING = {
  x: ROAD.x - RING_OFFSET,
  y: ROAD.y - RING_OFFSET,
  width: ROAD.width + RING_OFFSET * 2,
  height: ROAD.height + RING_OFFSET * 2,
  rx: ROAD.rx + RING_OFFSET
} as const;

/** Where the character stands when it is "at" the central plaza. */
const PLAZA_STAND: Pt = { x: 180, y: 300 };

const ARC_STEPS = 12;

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Appends unless it would duplicate the previous point. */
function push(pts: Pt[], p: Pt): void {
  const last = pts[pts.length - 1];
  if (!last || dist(last, p) > 0.01) pts.push(p);
}

/** Flattens a rounded rectangle into a clockwise polyline (open, not closed). */
function flattenRoundedRect(r: typeof RING): Pt[] {
  const { x, y, width: w, height: h, rx } = r;
  const pts: Pt[] = [];

  const arc = (cx: number, cy: number, from: number, to: number) => {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = from + ((to - from) * i) / ARC_STEPS;
      push(pts, { x: cx + rx * Math.cos(a), y: cy + rx * Math.sin(a) });
    }
  };

  const HALF_PI = Math.PI / 2;

  push(pts, { x: x + rx, y });
  push(pts, { x: x + w - rx, y });
  arc(x + w - rx, y + rx, -HALF_PI, 0);
  push(pts, { x: x + w, y: y + h - rx });
  arc(x + w - rx, y + h - rx, 0, HALF_PI);
  push(pts, { x: x + rx, y: y + h });
  arc(x + rx, y + h - rx, HALF_PI, Math.PI);
  push(pts, { x, y: y + rx });
  arc(x + rx, y + rx, Math.PI, Math.PI + HALF_PI);

  // Drop the closing duplicate of the first point — the ring is cyclic and the
  // wrap-around segment is implied by RING_LENGTH.
  const first = pts[0]!;
  while (pts.length > 1 && dist(pts[pts.length - 1]!, first) < 0.01) pts.pop();

  return pts;
}

export const RING_POINTS: readonly Pt[] = flattenRoundedRect(RING);

/** Cumulative arc length from RING_POINTS[0] to each point. */
const RING_CUM: readonly number[] = (() => {
  const cum = [0];
  for (let i = 1; i < RING_POINTS.length; i++) {
    cum.push(cum[i - 1]! + dist(RING_POINTS[i - 1]!, RING_POINTS[i]!));
  }
  return cum;
})();

/** Total length including the wrap-around segment back to point 0. */
export const RING_LENGTH: number =
  RING_CUM[RING_CUM.length - 1]! + dist(RING_POINTS[RING_POINTS.length - 1]!, RING_POINTS[0]!);

function nearestRingIndex(p: Pt): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < RING_POINTS.length; i++) {
    const d = dist(RING_POINTS[i]!, p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Shorter of the two ways round the ring, in length units. */
function ringDistance(from: number, to: number): number {
  const forward = (RING_CUM[to]! - RING_CUM[from]! + RING_LENGTH) % RING_LENGTH;
  return Math.min(forward, RING_LENGTH - forward);
}

/** Inclusive point list from one ring index to another, going the short way. */
function ringSlice(from: number, to: number): Pt[] {
  const n = RING_POINTS.length;
  const out: Pt[] = [];
  const forward = (RING_CUM[to]! - RING_CUM[from]! + RING_LENGTH) % RING_LENGTH;
  const step = forward <= RING_LENGTH - forward ? 1 : -1;

  let i = from;
  out.push(RING_POINTS[i]!);
  while (i !== to) {
    i = (i + step + n) % n;
    out.push(RING_POINTS[i]!);
  }
  return out;
}

const CROSSWALK_INDICES: readonly number[] = [
  nearestRingIndex({ x: RING.x, y: PLAZA_STAND.y }),
  nearestRingIndex({ x: RING.x + RING.width, y: PLAZA_STAND.y })
];

/** The ring index a perimeter building is entered from. */
function ringIndexFor(loc: LocationId): number {
  return nearestRingIndex(LAYOUT[loc]);
}

/** Whichever plaza crosswalk is nearer, measured along the ring. */
function crosswalkNearest(ringIndex: number): number {
  let best = CROSSWALK_INDICES[0]!;
  let bestD = Infinity;
  for (const c of CROSSWALK_INDICES) {
    const d = ringDistance(ringIndex, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Where the character stands while it is at `loc`. */
export function standPoint(loc: LocationId): Pt {
  if (loc === "theSpot") return { ...PLAZA_STAND };

  const anchor = RING_POINTS[ringIndexFor(loc)]!;
  const door = LAYOUT[loc];
  const dx = door.x - anchor.x;
  const dy = door.y - anchor.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: anchor.x + (dx / len) * STAND_NUDGE,
    y: anchor.y + (dy / len) * STAND_NUDGE
  };
}

/**
 * The full walk from one location to another: stand point → the ring → round
 * the short way → the ring → stand point. Trips to or from the plaza turn off
 * at whichever crosswalk is nearer along the ring.
 */
export function walkPath(from: LocationId, to: LocationId): Pt[] {
  const out: Pt[] = [];
  if (from === to) return [standPoint(from)];

  if (from !== "theSpot" && to !== "theSpot") {
    push(out, standPoint(from));
    for (const p of ringSlice(ringIndexFor(from), ringIndexFor(to))) push(out, p);
    push(out, standPoint(to));
    return out;
  }

  if (to === "theSpot") {
    const i = ringIndexFor(from);
    push(out, standPoint(from));
    for (const p of ringSlice(i, crosswalkNearest(i))) push(out, p);
    push(out, PLAZA_STAND);
    return out;
  }

  const j = ringIndexFor(to);
  push(out, PLAZA_STAND);
  for (const p of ringSlice(crosswalkNearest(j), j)) push(out, p);
  push(out, standPoint(to));
  return out;
}

export function pathLength(pts: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1]!, pts[i]!);
  return total;
}

/** Position at `distance` along the path, plus which way it is heading. */
export function pointAt(
  pts: readonly Pt[],
  distance: number
): { x: number; y: number; facing: 1 | -1 } {
  if (pts.length === 0) return { x: 0, y: 0, facing: 1 };
  if (pts.length === 1) return { ...pts[0]!, facing: 1 };

  const total = pathLength(pts);
  const d = Math.max(0, Math.min(distance, total));

  let travelled = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = dist(a, b);
    if (seg === 0) continue;
    if (travelled + seg >= d) {
      const k = (d - travelled) / seg;
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        facing: b.x >= a.x ? 1 : -1
      };
    }
    travelled += seg;
  }

  const last = pts[pts.length - 1]!;
  const prev = pts[pts.length - 2]!;
  return { ...last, facing: last.x >= prev.x ? 1 : -1 };
}

/**
 * Evenly-spaced points along the path. The animation feeds these to
 * `Animated.Value.interpolate`, so the count is deliberately small — it becomes
 * a native config payload sent across the bridge once per leg.
 */
export function resample(pts: readonly Pt[], n: number): Pt[] {
  if (n < 2) throw new Error("resample needs at least 2 points");
  if (pts.length === 0) return Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0]! }));

  const total = pathLength(pts);
  return Array.from({ length: n }, (_, i) => {
    const p = pointAt(pts, (total * i) / (n - 1));
    return { x: p.x, y: p.y };
  });
}

/** Milliseconds for a walk of this length — long trips visibly cost more. */
export const WALK_MS_PER_UNIT = 1.1;
export const WALK_MS_MIN = 200;
export const WALK_MS_MAX = 700;

export function walkDurationMs(length: number): number {
  return Math.round(Math.max(WALK_MS_MIN, Math.min(WALK_MS_MAX, length * WALK_MS_PER_UNIT)));
}

/** An SVG `d` string for a point list — used to draw the planned route. */
export function toSvgPath(pts: readonly Pt[]): string {
  if (pts.length === 0) return "";
  const [head, ...rest] = pts;
  return (
    `M ${head!.x.toFixed(2)} ${head!.y.toFixed(2)}` +
    rest.map((p) => ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("")
  );
}
