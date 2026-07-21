# Fast Lane — Milestone 1: The Fun Core (Design Spec)

- **Date:** 2026-07-21
- **Status:** Approved design → ready for implementation plan
- **Branch:** `feat/fun-core` (built on top of the Expo SDK 54 upgrade)
- **Milestone order:** **1) Fun core (this doc)** → 2) reskin remaining screens → 3) in-app solo mode → 4) ship to friends (EAS) → 5) content depth

---

## 1. Problem & thesis

The game is code-complete and technically works end-to-end, but a real on-device playtest produced the verdict that matters: **it's not fun — "I was just clicking buttons."** That is an _interaction_ problem, not an art problem. Prettier menus are still menus.

Fun in this genre stands on three legs. This milestone builds all three for the core loop:

1. **The map is the game.** A visible town you _move through_. Deciding where to go, under a time limit, is the actual decision — the thing Jones had that a menu doesn't.
2. **Time is the tension.** 60 time-units a week, draining as you travel and act. You _can't_ do everything, so every week is a real tradeoff.
3. **The reveal is the payoff.** A synced recap that roasts players by name. This is the social hook and the cheapest fun a solo dev can ship — it's writing, not art.

**Art direction (locked):** flat-vector "modern retro" — bold shapes, thick outlines, warm dusk palette. Not pixel, not isometric, not emoji-on-a-grid.

**Interaction model (locked):** tap-to-travel — tap a destination, the character walks there, travel spends time budget.

Reference mockups (concept, not final art): art directions, planning screen, and reveal screen artifacts produced during brainstorming.

---

## 2. Goals / Non-goals

**Goals**

- Rebuild the two screens that carry the game — **planning** and **reveal** — into the flat-vector, tap-to-travel experience.
- Make a single **Quick** game, played on a real phone (against the existing bot), feel like navigating a living town with real time pressure and a reveal that makes you laugh.
- Establish a reusable **flat-vector design system** that Milestone 2 uses to reskin the rest.

**Non-goals (explicitly deferred to later milestones)**

- Reskinning home / setup / create / join / lobby / game-over (Milestone 2).
- In-app solo/AI mode and tutorial (Milestone 3).
- EAS Update/build so friends can join without the dev server (Milestone 4).
- New locations or mechanics beyond comedy events (Milestone 5). We tune what exists; we don't add systems.

---

## 3. Key insight: the engine already supports this

Verified in `packages/engine/src`:

- `types.ts`: `LocationId`, `Action` union already includes `{ type: "travel"; to: LocationId }` plus `work`, `study`, `buy`, `sell`, `eat`, `bank`, `crypto`, `lottery`, `fun`, `payRent`, `moveApartment`, `applyJob`, `rest`. `PlayerState.location` tracks where the player is.
- `config/balance.ts`: travel costs (`adjacentTU`), town adjacency (`ZONES` west/east), jobs bound to locations (`applyAt`), housing tiers, item catalog.
- `validate.ts`: `validatePlan` already simulates the plan sequentially — location context, TU budget, cash floor.
- `resolve.ts`: `resolveWeek` already produces a per-player **ledger** and event cards (the raw material the reveal needs).
- `goals.ts`: win checks + goal progress (the standings bars).

**Consequence:** Milestone 1 is overwhelmingly a **client + content** effort. The town map is a new front-end that emits the _same_ `Action[]` the server already validates; the reveal is a new front-end over the _same_ `round_results` the server already writes. **No server changes, and at most cosmetic engine additions (a couple of comedy events).** The pure/deterministic engine and its 107 passing tests stay intact.

---

## 4. Deliverables

### 4.1 Flat-vector design system (`apps/mobile/src/theme` + `src/components/ui`)

Reusable foundation, not one-off screen styling:

- **Tokens:** palette (coral `#ff5a4d`, teal `#1eb6a0`, gold `#e9a51f`, violet `#7d63e8`, warm neutrals), type scale, spacing, radii, shadows. Dark app chrome + bright town.
- **Primitives:** `Chip`/stat pill, `Card`, `PrimaryButton`, `Meter` (the time bar), `Avatar`, and a `Building` component (flat-vector body + sign + glyph) parameterized by `LocationId`.
- **Location icons (explicit quality bar):** each of the 11 locations gets its own **distinct, polished flat-vector icon/silhouette** — a real crafted mark per place (burger, mortarboard, bank columns, screen, disco, cart, house, …), not the crude placeholder glyphs in the concept mockups. This is a named acceptance item, not "nice to have." Icons are a reusable `LocationIcon` set so the map, action sheets, plan-tray chips, and reveal cards all share one visual language.
- All colors/spacing come from tokens so Milestone 2 reskins by reuse.

### 4.2 Planning screen (`app/game/[id]/play.tsx` + `src/components/TownMap.tsx`, `PlanTray.tsx`, `LocationSheet.tsx`)

Replaces the current tappable grid with the tap-to-travel town:

- **Top bar:** week #, server-clock countdown ring, opponents' submit-status dots.
- **Stats strip:** cash, happiness, education, career tier, hunger warning — as flat-vector chips.
- **Time meter:** 60 TU, draining as travel + actions are queued; visually shifts warm as it empties. This is the tension surfaced.
- **Town map:** flat-vector map with the locations that exist in the engine (`burgerBarn`, `college`, `bank`, `gadgetCity`, `quickMart`, `careerHub`, `theSpot`/nightlife, `rentALord`, `flipIt`, `dressCode`, home). Character at current `location`; roads connect zones; tapping a building appends a `travel` action (TU-costed from `balance.ts`) and opens its **action sheet**.
- **Action sheets** per building: the location-relevant actions (e.g., Burger Barn → work slider, buy meal), each appending the corresponding engine `Action`.
- **Route/plan tray:** ordered chips of queued actions with running TU + projected cash (client runs `validatePlan` for instant feedback), drag to reorder, swipe to delete.
- **Submit:** "Lock in the week" → same `submit-plan` payload as today.
- **Design target:** a full week plannable in under ~60 seconds with one thumb.

### 4.3 Reveal screen (`app/game/[id]/reveal.tsx`)

Replaces the minimal current reveal with the choreographed payoff:

- Week splash → global event card(s) → **per-player roast cards** (biggest waste / biggest earn / funniest fail, picked from the ledger via heuristics) → standings with four goal-progress bars per player → "Next week" (auto-advances). If someone won → route to game-over.
- Cards are tap-to-skip; the sequence is derived entirely from `round_results` (server truth).

### 4.4 Comedy content layer (`packages/engine/src/events.ts` + `apps/mobile/src/i18n/{en,he}.json`)

- Roast/event lines as **templated i18n keys with params**: `"{{name}} blew {{amount}} at {{place}}."` — content, not code.
- A "juiciest moment" picker that scans a week's ledger and selects 3–5 cards.
- Seed set of lines in en + he; the human author punches up the comedy. All strings keyed; RTL verified.

---

## 5. Architecture & data flow

Unchanged authority model (`docs/DEV_PLAN.md` §3.3):

1. Player navigates the town → client builds an ordered `Action[]` → client `validatePlan` for live feedback only.
2. **Submit** → `submit-plan` edge function (unchanged) → server re-validates with the engine → resolves via `resolveWeek`.
3. Client subscribes to realtime; on `round_results` it renders the **reveal** from server data only.
4. `hydrateFromSnapshot()` remains the single state-entry path (reconnect-safe).

The redesign touches **presentation and content**. It does not touch the server, RLS, realtime, or the deterministic engine core.

---

## 6. i18n / RTL

- Every user-facing string is an i18n key (en + he) from the first commit — no hardcoded copy.
- Numbers stay LTR inside RTL layouts; currency symbol is cosmetic per locale.
- Each new screen is verified in Hebrew (RTL mirrored) as part of done.

---

## 7. Testing & verification

- Engine + shared suites (107 tests) must stay green — the redesign must not regress them.
- Client `tsc --noEmit` clean; `expo export` bundles.
- **Acceptance:** play a full **Quick** game on a real iPhone (Expo Go SDK 54) against the bot: navigate the town, feel the time squeeze, reach a reveal that names names. The "just clicking buttons" feeling is gone.

---

## 8. Risks & mitigations

- **Map readability on small screens** → design mobile-first; cap visible locations; test on a real phone early, not at the end.
- **Route/travel UX confusing** → show travel cost on tap and a clear running time budget; the plan tray is the source of truth the player can edit.
- **Comedy falling flat** → ship the _mechanism_ + a seed set; the human owns final lines; lines are config so they iterate without code.
- **Scope creep into other screens** → hard non-goals in §2; anything outside planning/reveal/design-system is a later milestone.

---

## 9. Success criteria

1. A Quick game on a real phone reads as _moving through a town_, not operating a menu.
2. The time budget forces a visible weekly tradeoff.
3. The reveal produces at least one "oh no / lol" moment naming a player.
4. Flat-vector design system exists and is reused across both screens.
5. Each of the 11 locations has its own polished, distinct flat-vector icon (no crude placeholder glyphs).
6. Engine tests green; app bundles; Hebrew/RTL verified.

---

## 10. Out of scope / next milestones

2. **Reskin the rest** — home, setup, create, join, lobby, game-over in flat vector using §4.1.
3. **Solo mode** — in-app AI opponent + tutorial.
4. **Ship to friends** — EAS Update/build.
5. **Content depth** — more events, locations, balance for late-game freshness.
