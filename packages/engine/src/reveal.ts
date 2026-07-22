/**
 * pickRevealCards (spec §4.4): scans one resolved week and selects its
 * "juiciest moments" as an ordered, capped list of reveal cards.
 *
 * Pure and deterministic — no i18n, no Date.now(), no Math.random(). The
 * engine emits i18n KEYS + params keyed by slot; the CLIENT translates each
 * key and injects the player's display name (the engine only knows slots).
 *
 * Ordering: global event cards first, then per-player roasts. Roasts are
 * capped so the reveal stays punchy, and each slot is spotlighted at most
 * once so the comedy spreads across players instead of piling on one victim.
 */
import { REVEAL } from "./config/balance";
import type { EventCard, EventCategory, LedgerLine } from "./types";

export type RevealCard =
  | { kind: "global"; i18nKey: string; params: Record<string, string | number> }
  | { kind: "player"; slot: number; i18nKey: string; params: Record<string, string | number> };

/**
 * The subset of a resolved week that pickRevealCards actually reads. Both a
 * full `WeekResult` and a persisted `round_results` row satisfy this shape,
 * so the client can pass DB data straight in without a cast.
 */
export interface RevealInput {
  globalEvents: EventCard[];
  players: ReadonlyArray<{
    slot: number;
    ledger: LedgerLine[];
    eventCards: EventCard[];
  }>;
}

/** Per-player money/mood totals derived from the week's ledger. */
interface PlayerTally {
  slot: number;
  /** Sum of positive cash deltas (₪ earned). */
  earned: number;
  /** Sum of negative cash deltas, as a positive magnitude (₪ spent). */
  spent: number;
  /** Net happiness change across the week. */
  moodNet: number;
}

/** Event categories worth surfacing as a per-player drama card. */
const JUICY_EVENT_CATEGORIES: ReadonlySet<EventCategory> = new Set<EventCategory>([
  "personal",
  "social",
  "jackpot"
]);

function tally(p: RevealInput["players"][number]): PlayerTally {
  let earned = 0;
  let spent = 0;
  let moodNet = 0;
  for (const line of p.ledger) {
    if (line.cashDelta) {
      if (line.cashDelta > 0) earned += line.cashDelta;
      else spent += -line.cashDelta;
    }
    if (line.happinessDelta) moodNet += line.happinessDelta;
  }
  return { slot: p.slot, earned, spent, moodNet };
}

/**
 * Returns the item with the highest score. Iterates in the given order and
 * keeps the first maximum on ties, so passing slot-ordered input makes the
 * tie-break "lowest slot wins" — fully deterministic.
 */
function best<T>(items: readonly T[], score: (t: T) => number): T | undefined {
  let winner: T | undefined;
  let winningScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > winningScore) {
      winningScore = s;
      winner = item;
    }
  }
  return winner;
}

export function pickRevealCards(week: RevealInput): RevealCard[] {
  const globals: RevealCard[] = week.globalEvents.map((c) => ({
    kind: "global",
    i18nKey: c.key,
    params: c.params ?? {}
  }));

  const tallies = week.players.map(tally);

  // Signature roasts, in priority order. Each surfaces the single most extreme
  // player for that category when the swing clears its balance-tuned floor.
  const roasts: RevealCard[] = [];

  const spender = best(tallies, (t) => t.spent);
  if (spender && spender.spent >= REVEAL.cashRoastFloor) {
    roasts.push({
      kind: "player",
      slot: spender.slot,
      i18nKey: "reveal.bigSpender",
      params: { amount: Math.round(spender.spent) }
    });
  }

  const earner = best(tallies, (t) => t.earned);
  if (earner && earner.earned >= REVEAL.cashRoastFloor) {
    roasts.push({
      kind: "player",
      slot: earner.slot,
      i18nKey: "reveal.topEarner",
      params: { amount: Math.round(earner.earned) }
    });
  }

  const saddest = best(tallies, (t) => -t.moodNet);
  if (saddest && -saddest.moodNet >= REVEAL.moodRoastFloor) {
    roasts.push({
      kind: "player",
      slot: saddest.slot,
      i18nKey: "reveal.roastSad",
      params: { amount: -saddest.moodNet }
    });
  }

  const happiest = best(tallies, (t) => t.moodNet);
  if (happiest && happiest.moodNet >= REVEAL.moodRoastFloor) {
    roasts.push({
      kind: "player",
      slot: happiest.slot,
      i18nKey: "reveal.roastHappy",
      params: { amount: happiest.moodNet }
    });
  }

  // Drama cards: pass each juicy personal/social/jackpot event through with
  // its own i18n key (e.g. event.jackpot, event.evicted, event.robbery).
  const events: RevealCard[] = [];
  for (const p of week.players) {
    for (const ev of p.eventCards) {
      if (JUICY_EVENT_CATEGORIES.has(ev.category)) {
        events.push({
          kind: "player",
          slot: p.slot,
          i18nKey: ev.key,
          params: ev.params ?? {}
        });
      }
    }
  }

  // Spotlight each slot at most once (roasts win over generic event lines),
  // then fill the remaining budget after the global cards.
  const players: RevealCard[] = [];
  const usedSlots = new Set<number>();
  for (const card of [...roasts, ...events]) {
    if (card.kind !== "player") continue;
    if (usedSlots.has(card.slot)) continue;
    usedSlots.add(card.slot);
    players.push(card);
  }

  const budget = Math.max(0, REVEAL.maxCards - globals.length);
  return [...globals, ...players.slice(0, budget)];
}
