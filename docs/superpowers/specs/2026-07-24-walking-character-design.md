# Walking character on the town map — design

**Date:** 2026-07-24
**Branch:** `feat/fun-core`
**Milestone:** Fun core, fix #2 (of the three raised in the 2026-07-22 playtest)

## Problem

`TownMap` draws the player as a static figure at `towardCenter(LAYOUT[current], 32)`.
`current` is `planLocation` — already the _end_ of the queued route — so tapping a
building teleports the figure. Travelling produces no motion, no direction, no sense
of distance. The planned route is drawn as straight `Line`s between buildings, cutting
across the grass and ignoring the loop road beside it.

Net effect, in the playtester's words: you don't see your character walking, so you
don't know where you are or what you're doing. The map reads as a picker, not a place.

## Goals

1. Tapping a building makes the character **walk there**, on the road, before the
   action sheet opens.
2. On-screen distance is **honest about the trip's cost** — a long walk takes visibly
   longer, matching the Time Units the engine already charges.
3. The planned-route preview and the actual walk trace **the same geometry**.

## Non-goals

- Opponents walking on the map. Plans are simultaneous and hidden until reveal;
  showing rival movement during planning would leak information.
- Reveal-time replay of the week's route.
- Any new native module. No Reanimated, no gesture-handler — this protects the
  Expo Go / SDK 54 path.
- Icon redraw — that is fix #3, tracked separately.

## Decisions

### Walk timing

Tap → character walks → **on arrival** the action sheet opens. Chosen over
"sheet opens immediately" because the delay is thematically correct: travel costs
Time Units, so making the player watch the trip reinforces a real mechanic instead of
decorating it. Tapping the building you are already at opens the sheet with no walk.

### Path shape: the road, offset outward

The character walks a **closed ring** = the road centreline pushed 8px toward the
buildings, so it hugs the storefronts rather than straddling the lane dashes.

A separate sidewalk lane was considered and rejected on measurement: west buildings
span `x ∈ [17, 75]` and the road's outer edge is `x = 78` — a 3px gap, no room. The
sidewalk existed only to avoid a detour on same-column hops, and that detour does not
occur: the road runs parallel to both building columns, so Home → Burger Barn is
"step out, walk down, step in" (~160px vs 78px straight-line). Natural, not a lap.

```
ROAD (existing art)  x=95  y=75  w=170  h=420  rx=75   stroke 34
RING (walk path)     x=87  y=67  w=186  h=436  rx=83   (centreline + 8 outward)
```

`8 < 17` (half the road stroke), so the walker stays inside the road band.

### The plaza

`theSpot` sits inside the loop at `(180, 285)`, so it cannot be reached along the ring.
It gets a **crosswalk spur**: the player stands at `(180, 322)`, just below the plaza
building, and reaches it by a straight segment from one of two ring crosswalks —
left `(87, 285)` or right `(273, 285)` — whichever is nearer _along the ring_ to the
trip's origin. Deterministic and symmetric.

## Architecture

### `apps/mobile/src/town/geometry.ts` — new, pure

Plain TypeScript. No React, no React Native, no `@fastlane/engine` runtime import
(`LocationId` is a type-only import). Takes ownership of `W`, `H`, `LAYOUT`, `ROAD`
and `BUILDING_SIZE`, currently defined inside `TownMap.tsx`, so map geometry has a
single owner.

| Export                       | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `RING_POINTS`, `RING_LENGTH` | ring flattened once to a polyline + cumulative arc-length table |
| `standPoint(loc)`            | where the character stands when at `loc`                        |
| `walkPath(from, to)`         | full point list: stand → ring (shorter way round) → stand       |
| `pathLength(pts)`            | total length                                                    |
| `pointAt(pts, dist)`         | `{ x, y, facing }` — `facing` drives the sprite flip            |
| `resample(pts, n)`           | evenly-spaced points, for a fixed-size interpolation payload    |
| `walkDurationMs(len)`        | `clamp(len × 1.1, 200, 700)`                                    |

Direction round the ring is chosen by comparing forward and backward arc distance.
Everything is a pure function over numbers — this is the part that carries tests.

### `apps/mobile/src/components/Walker.tsx` — new

An absolutely-positioned `Animated.View` wrapping a small SVG character (reusing the
head/body shapes already in `TownMap`).

- One `Animated.Value` `t: 0 → 1`, **`useNativeDriver: true`**.
- Position from `t.interpolate()` with the path resampled to **24 points** as
  `inputRange`/`outputRange`. Path-following therefore runs on the UI thread with no
  JS work per frame — which is what buys smoothness without Reanimated. 24 keeps the
  native config payload small; the ring's curvature is gentle enough that it reads as
  a curve.
- A small looped sine bob plus a horizontal flip sells the walk cheaply. The flip is
  computed **once per leg** from the path's endpoints, not per point: interpolating
  `scaleX` between +1 and −1 would squash the sprite flat as it passed through zero.
  `pointAt` still returns per-point `facing`, which the tests assert against.

### `TownMap.tsx` — modified

- Imports geometry instead of defining it.
- `onLayout` → `scale = width / W`, converting viewBox units to px for the walker.
  Buildings keep their existing percentage positioning.
- The planned-route dashes are rebuilt from `walkPath`, so preview and walk agree.
- New prop `onArrive?: (loc: LocationId) => void`, fired when a walk completes.
- **Fixes a latent bug in the route preview.** The old `current` prop was
  `planLocation` — the _end_ of the plan — and the route was drawn as
  `[LAYOUT[current], ...plannedTravels]`, so the first dashed segment ran from the
  final destination back to the first stop. The prop is replaced by `origin` (the
  player's real location) and the map derives the destination itself as the last
  queued travel, which is both correct and what the walker needs anyway.

### `play.tsx` — modified

`selectLocation` currently calls `addAction` then `setSheet` in the same breath.
It now only adds the travel; the sheet opens from `onArrive`. Tapping the current
location opens the sheet directly.

## Interaction rules

- **Interruption:** at most one pending destination. A tap during a walk collapses any
  queued destination and re-targets — the in-flight leg finishes at 3× speed, then the
  new leg plays. Never jumps backwards, never degrades into a slideshow.
- **Snap, don't walk** on mount and on round change, via a `snapKey` prop keyed to
  game id + round number. Deleting a travel from the PlanTray was also going to snap,
  but detecting "this destination change is an undo" needs a heuristic that would be
  wrong at the edges; the character simply walks back instead, which reads as
  retracing your steps and costs nothing to implement.
- **Reduced motion:** when `AccessibilityInfo.isReduceMotionEnabled` is true, snap to
  the destination and open the sheet immediately.

## Testing

`apps/mobile` currently has no test script, and root `test` is
`pnpm -r --filter=./packages/* run test` — so CI cannot see client code at all. This
change adds `vitest` + `vitest.config.ts` + `"test": "vitest run"` to `apps/mobile`
and changes root `test` to `pnpm -r run test`. CI's existing `pnpm test` step then
covers the app, unlocking client-side testing permanently.

Tests on `geometry.ts`:

1. For all 11×11 location pairs, the path starts at `standPoint(from)` and ends at
   `standPoint(to)`.
2. Same-column neighbours are shorter than any cross-town path — the no-detour
   guarantee.
3. Shorter-arc selection: the chosen direction is never longer than the other.
4. Every intermediate point lies on the ring or on a plaza crosswalk spur, within
   tolerance — i.e. the character never walks on grass.
5. `pointAt` is monotonic in distance and exact at both endpoints.
6. `theSpot` paths cross the road band.
7. `walkPath` is deterministic — same input, same output.

The engine is untouched, so the determinism suite stays green by construction.

## Definition of done

`pnpm lint`, `pnpm typecheck`, `pnpm test` green; mobile `tsc --noEmit` clean;
`expo export` still bundles. Then a device check: the town reads as navigation, and
a long trip feels longer than a short one.
