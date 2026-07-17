/**
 * "The Grinder" heuristic bot: work-study-eat policy used by the balance
 * simulator (and later as a Phase 8 opponent baseline). Deterministic given
 * the state — no RNG needed.
 */

import {
  EDUCATION,
  FOOD,
  FUN,
  ITEMS,
  JOBS,
  OUTFITS,
  TIME_UNITS_PER_WEEK,
  WORK,
  type JobDefinition
} from "../config/balance";
import { totalCourses } from "../state";
import type { Action, GameState, LocationId, OutfitId, PlayerState } from "../types";
import { validatePlan } from "../validate";

function hasOutfit(p: PlayerState, outfit: OutfitId, minWeeks = 1): boolean {
  return p.outfits.some((o) => o.outfit === outfit && o.weeksLeft >= minWeeks);
}

function outfitPrice(outfit: OutfitId): number {
  return OUTFITS.find((o) => o.id === outfit)!.price;
}

/**
 * Highest tier the player qualifies for right now. When `budget` allows
 * buying a missing required outfit this week, the tier still counts and
 * the needed outfit is reported.
 */
function bestTier(
  p: PlayerState,
  budget: number
): { tier: number; needOutfit: OutfitId | null } {
  const courses = totalCourses(p);
  let best: { tier: number; needOutfit: OutfitId | null } = {
    tier: p.items.includes("phone") ? 0 : -1,
    needOutfit: null
  };
  for (const job of JOBS as readonly JobDefinition[]) {
    const r = job.requirements;
    if (job.tier === 0) continue;
    if (r.courses !== undefined && courses < r.courses) continue;
    if (r.degree && courses < EDUCATION.degreeCourses) continue;
    if (r.weeksWorked !== undefined && p.weeksWorked < r.weeksWorked) continue;
    if (r.track && p.courses[r.track] < (r.courses ?? 0)) continue;
    if (r.items && !r.items.every((i) => p.items.includes(i))) continue;
    let needOutfit: OutfitId | null = null;
    if (r.outfit && !hasOutfit(p, r.outfit)) {
      if (budget >= outfitPrice(r.outfit)) needOutfit = r.outfit;
      else continue; // can't afford the dress code yet
    }
    if (job.tier > best.tier) best = { tier: job.tier, needOutfit };
  }
  return best;
}

export function greedyPlan(state: GameState, slot: number): Action[] {
  const p = state.players[slot];
  if (!p) return [{ type: "rest", tu: TIME_UNITS_PER_WEEK }];
  const goals = state.settings.goals;
  const plan: Action[] = [];
  let loc: LocationId = p.location;

  const goto = (to: LocationId) => {
    if (loc !== to) {
      plan.push({ type: "travel", to });
      loc = to;
    }
  };

  // Reserve food money up front; everything else spends from `budget`.
  const wantFun = p.happiness < goals.happiness + 5;
  const reserve = FOOD.basicCost + (wantFun ? FUN.club.cost : 0);
  let budget = Math.max(0, p.cash - reserve);
  const courses = totalCourses(p);
  const currentTier = p.jobTier;

  // 1. Keep the CURRENT job's dress code alive (outfits wear out).
  if (currentTier > 0) {
    const job = JOBS.find((j) => j.tier === currentTier)!;
    const req = job.requirements.outfit;
    if (req && !hasOutfit(p, req, 2) && budget >= outfitPrice(req)) {
      goto("dressCode");
      plan.push({ type: "buyOutfit", outfit: req });
      budget -= outfitPrice(req);
    }
  }

  // 2. Climb: apply for the best reachable tier (buying its outfit if needed).
  const reach = bestTier(p, budget);
  if (reach.tier > Math.max(0, currentTier)) {
    if (reach.needOutfit) {
      goto("dressCode");
      plan.push({ type: "buyOutfit", outfit: reach.needOutfit });
      budget -= outfitPrice(reach.needOutfit);
    }
    const job = JOBS.find((j) => j.tier === reach.tier)!;
    goto(job.requirements.applyAt ?? "careerHub");
    plan.push({ type: "applyJob", tier: job.tier });
  } else if (currentTier === -1) {
    goto("burgerBarn");
    plan.push({ type: "applyJob", tier: 1 });
  }

  // 3. Study toward the course goal (and the goal tier's requirements).
  // T4 (junior dev) is tech-track gated, so aim tech when the goal is T4;
  // higher tiers route through T5/T6 which are track-agnostic.
  const track = goals.careerTier === 4 ? "tech" : "business";
  const jobCoursesNeeded = JOBS.find((j) => j.tier === goals.careerTier)?.requirements.courses ?? 0;
  const courseTarget = Math.max(goals.courses, jobCoursesNeeded);
  if (courses < courseTarget && budget >= EDUCATION.courseCost) {
    const n = Math.min(2, courseTarget - courses, Math.floor(budget / EDUCATION.courseCost));
    if (n > 0) {
      goto("college");
      for (let i = 0; i < n; i++) {
        plan.push({ type: "study", courseTrack: track });
        budget -= EDUCATION.courseCost;
      }
    }
  }

  // 3b. Buy the laptop when chasing a laptop-gated tier (T4).
  const goalJob = JOBS.find((j) => j.tier === goals.careerTier);
  const laptopPrice = ITEMS.find((i) => i.id === "laptop")!.price;
  if (
    goalJob?.requirements.items?.includes("laptop") &&
    !p.items.includes("laptop") &&
    budget >= laptopPrice
  ) {
    goto("gadgetCity");
    plan.push({ type: "buy", item: "laptop" });
    budget -= laptopPrice;
  }

  // 4. Work a solid shift at the job held after step 2.
  const workTier = Math.max(1, Math.min(6, Math.max(reach.tier, currentTier)));
  const job = JOBS.find((j) => j.tier === workTier)!;
  if (job.location) {
    goto(job.location);
    plan.push({ type: "work", tu: Math.min(WORK.maxWeeklyTU, 28) });
  }

  // 5. Eat (reserved money).
  goto("quickMart");
  plan.push({ type: "eat", kind: "basic" });

  // 6. Fun when happiness is below goal (club is the best ROI).
  if (wantFun && p.cash >= reserve) {
    goto("theSpot");
    plan.push({ type: "fun", kind: "club" });
  }

  // Repair loop: drop the specific failing action (and its dangling travel)
  // instead of blind tail-trimming, so later actions like `eat` survive.
  let candidate = [...plan];
  for (let guard = 0; guard < 20; guard++) {
    const v = validatePlan(state, slot, candidate);
    if (v.ok) break;
    const bad = v.errors[0]!.index;
    candidate = candidate.filter((_, i) => i !== bad);
  }
  if (candidate.length === 0 || !validatePlan(state, slot, candidate).ok) {
    return [{ type: "rest", tu: TIME_UNITS_PER_WEEK }];
  }
  return candidate;
}
