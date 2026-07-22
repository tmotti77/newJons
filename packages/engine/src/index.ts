// packages/engine — pure, deterministic TypeScript game engine.
// Golden rule (DEV_PLAN §3.3 / §8.1): no I/O, no Date.now(), no Math.random(),
// no imports from apps/ or supabase/.

export * from "./types";
export * from "./config/balance";
export {
  GLOBAL_LANE,
  chance,
  intBetween,
  mulberry32,
  rngFor,
  symmetric,
  weightedPick
} from "./rng";
export {
  currentRent,
  defaultSettings,
  hasUsableOutfit,
  initialGameState,
  initialPlayerState,
  itemResaleValue,
  itemValue,
  netWorth,
  totalCourses,
  trackWithMostCourses,
  travelCost
} from "./state";
export { validatePlan } from "./validate";
export { autoRestPlan, resolveWeek } from "./resolve";
export { capWinner, goalProgress, standings, weekWinner } from "./goals";
export { rollGlobalEvents, rollPersonalEvents } from "./events";
export { pickRevealCards } from "./reveal";
export type { RevealCard } from "./reveal";
