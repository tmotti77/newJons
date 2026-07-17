/**
 * Win-condition checks + week-cap weighted scoring (DEV_PLAN §2.7).
 */

import { netWorth, totalCourses } from "./state";
import type { GameState, GoalProgress, PlayerState } from "./types";

export function goalProgress(state: GameState, p: PlayerState): GoalProgress {
  const goals = state.settings.goals;
  const worth = netWorth(p, state.cryptoPrice);
  const courses = totalCourses(p);
  const tier = Math.max(0, p.jobTier);

  const pct = {
    netWorth: Math.min(1, worth / goals.netWorth),
    happiness: Math.min(1, p.happiness / goals.happiness),
    courses: Math.min(1, courses / goals.courses),
    careerTier: Math.min(1, tier / goals.careerTier)
  };

  // Equal weights v1 (§2.7).
  const score = pct.netWorth + pct.happiness + pct.courses + pct.careerTier;

  return {
    netWorth: worth,
    happiness: p.happiness,
    courses,
    careerTier: tier,
    pct,
    score,
    achievedAll:
      pct.netWorth >= 1 && pct.happiness >= 1 && pct.courses >= 1 && pct.careerTier >= 1
  };
}

/**
 * Standings: slots ordered best-first by weighted score.
 * Deterministic tiebreak by slot (stable across clients).
 */
export function standings(state: GameState): number[] {
  const scored = state.players.map((p) => ({
    slot: p.slot,
    score: goalProgress(state, p).score
  }));
  scored.sort((a, b) => b.score - a.score || a.slot - b.slot);
  return scored.map((s) => s.slot);
}

/**
 * Winner for the week, if any: all-four-goals first; same-week ties break
 * by higher total weighted score, then lower slot (§2.7).
 */
export function weekWinner(state: GameState): number | undefined {
  const achievers = state.players
    .map((p) => ({ slot: p.slot, gp: goalProgress(state, p) }))
    .filter((x) => x.gp.achievedAll);
  if (achievers.length === 0) return undefined;
  achievers.sort((a, b) => b.gp.score - a.gp.score || a.slot - b.slot);
  return achievers[0]!.slot;
}

/** Week-cap fallback: highest weighted score wins (§2.1/§2.7). */
export function capWinner(state: GameState): number {
  return standings(state)[0]!;
}
