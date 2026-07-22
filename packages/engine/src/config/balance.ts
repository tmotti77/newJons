/**
 * ALL tunable game numbers live here (DEV_PLAN §3.2 / §8.1).
 * Nothing outside this file may hardcode a balance number.
 * Seeded from the §2 tables; tuned by scripts/balance-sim.ts.
 */

import type { GoalSet, HousingTier, ItemId, JobTier, LocationId, OutfitId } from "../types";

export const TIME_UNITS_PER_WEEK = 60;

// ---------- happiness ----------

export const HAPPINESS = {
  min: 0,
  max: 100,
  start: 60,
  weeklyDecay: 3,
  burnoutThreshold: 20,
  /** Wage multiplier applied when below burnout threshold. */
  burnoutWageMultiplier: 0.75,
  /** +2 happiness per unspent-TU block (auto-rest), per §2.2. */
  restBonusPerBlock: 2,
  /** TU per rest block. */
  restBlockTU: 10
} as const;

// ---------- food / hunger ----------

export const FOOD = {
  basicCost: 30,
  bulkCost: 75, // 3 weeks of food, needs fridge
  bulkWeeks: 3,
  deliveryCost: 40, // eat at home without traveling
  missedMealHappinessPenalty: 15,
  /** Wage multiplier next week when hungry. */
  hungryWageMultiplier: 0.9,
  eatTU: 2
} as const;

// ---------- travel ----------

export const TRAVEL = {
  adjacentTU: 2,
  acrossTownTU: 4,
  bikeDiscount: 1,
  carDiscount: 2,
  minTU: 1
} as const;

/**
 * Town adjacency: two zones (west/east). Same zone = adjacent cost,
 * cross-zone = across-town cost. Simple, readable, easily re-mapped later.
 */
export const LOCATION_ZONE: Record<LocationId, 0 | 1> = {
  home: 0,
  burgerBarn: 0,
  quickMart: 0,
  theSpot: 0,
  rentALord: 0,
  flipIt: 0,
  college: 1,
  gadgetCity: 1,
  dressCode: 1,
  careerHub: 1,
  bank: 1
};

// ---------- jobs (§2.5) ----------

export interface JobDefinition {
  tier: JobTier;
  nameKey: string;
  wagePerTU: number;
  /** Where you must be to work this job; null = anywhere (gig via phone). */
  location: LocationId | null;
  requirements: {
    courses?: number;
    weeksWorked?: number;
    outfit?: OutfitId;
    degree?: boolean;
    track?: "tech";
    items?: ItemId[];
    /** Must apply in person at this location. */
    applyAt?: LocationId;
  };
}

export const JOBS: readonly JobDefinition[] = [
  {
    tier: 0,
    nameKey: "job.gig",
    wagePerTU: 8,
    location: null,
    requirements: { items: ["phone"] }
  },
  {
    tier: 1,
    nameKey: "job.burgerCrew",
    wagePerTU: 10,
    location: "burgerBarn",
    requirements: { applyAt: "burgerBarn" }
  },
  {
    tier: 2,
    nameKey: "job.shiftLead",
    wagePerTU: 14,
    location: "burgerBarn",
    requirements: { courses: 2, weeksWorked: 3, applyAt: "careerHub" }
  },
  {
    tier: 3,
    nameKey: "job.officeAssistant",
    wagePerTU: 18,
    location: "careerHub",
    requirements: { courses: 4, outfit: "business", applyAt: "careerHub" }
  },
  {
    tier: 4,
    nameKey: "job.juniorDev",
    wagePerTU: 26,
    location: "careerHub",
    requirements: { courses: 8, track: "tech", items: ["laptop"], applyAt: "careerHub" }
  },
  {
    tier: 5,
    nameKey: "job.manager",
    wagePerTU: 32,
    location: "careerHub",
    requirements: { courses: 10, weeksWorked: 8, outfit: "business", applyAt: "careerHub" }
  },
  {
    tier: 6,
    nameKey: "job.executive",
    wagePerTU: 45,
    location: "careerHub",
    requirements: { degree: true, weeksWorked: 12, outfit: "luxury", applyAt: "careerHub" }
  }
] as const;

export const WORK = {
  minShiftTU: 4,
  maxWeeklyTU: 40
} as const;

// ---------- education ----------

export const EDUCATION = {
  courseCost: 50,
  courseTU: 10,
  /** Laptop reduces course TU when studying at home (§2.3). */
  laptopTUDiscount: 2,
  degreeCourses: 12
} as const;

// ---------- housing (§2.4) ----------

export interface HousingDefinition {
  tier: HousingTier;
  nameKey: string;
  rentPerWeek: number;
  happinessPerWeek: number;
}

export const HOUSING: readonly HousingDefinition[] = [
  { tier: 0, nameKey: "housing.roachTowers", rentPerWeek: 80, happinessPerWeek: 0 },
  { tier: 1, nameKey: "housing.midtownFlat", rentPerWeek: 160, happinessPerWeek: 3 },
  { tier: 2, nameKey: "housing.skylineLofts", rentPerWeek: 320, happinessPerWeek: 8 }
] as const;

export const RENT = {
  lateNoticeHappinessPenalty: 10,
  evictionHappinessPenalty: 20,
  /** Weekly happiness penalty while living at the Shelter. */
  shelterHappinessPenalty: 5,
  /** Deposit (x weekly rent) required to move in / return after eviction. */
  depositWeeks: 1,
  globalHikePct: 5,
  globalHikeIntervalWeeks: 4,
  moveTU: 4
} as const;

// ---------- items (Gadget City prices; Flip It resale 50%, used buy 70%) ----------

export interface ItemDefinition {
  id: ItemId;
  nameKey: string;
  price: number;
  /** Weekly happiness while owned. */
  happinessPerWeek: number;
  buyAt: LocationId;
}

export const ITEMS: readonly ItemDefinition[] = [
  { id: "phone", nameKey: "item.phone", price: 150, happinessPerWeek: 1, buyAt: "gadgetCity" },
  { id: "tv", nameKey: "item.tv", price: 250, happinessPerWeek: 2, buyAt: "gadgetCity" },
  { id: "console", nameKey: "item.console", price: 350, happinessPerWeek: 3, buyAt: "gadgetCity" },
  { id: "fridge", nameKey: "item.fridge", price: 300, happinessPerWeek: 0, buyAt: "gadgetCity" },
  { id: "laptop", nameKey: "item.laptop", price: 500, happinessPerWeek: 1, buyAt: "gadgetCity" },
  { id: "bike", nameKey: "item.bike", price: 200, happinessPerWeek: 1, buyAt: "gadgetCity" },
  { id: "car", nameKey: "item.car", price: 1200, happinessPerWeek: 2, buyAt: "gadgetCity" }
] as const;

export const SHOP = {
  buyTU: 2,
  sellPct: 50,
  usedBuyPct: 70
} as const;

// ---------- outfits ----------

export interface OutfitDefinition {
  id: OutfitId;
  nameKey: string;
  price: number;
  wearWeeks: number;
}

export const OUTFITS: readonly OutfitDefinition[] = [
  { id: "casual", nameKey: "outfit.casual", price: 60, wearWeeks: 8 },
  { id: "business", nameKey: "outfit.business", price: 180, wearWeeks: 8 },
  { id: "luxury", nameKey: "outfit.luxury", price: 450, wearWeeks: 8 }
] as const;

// ---------- bank / crypto / lottery ----------

export const BANK = {
  weeklyInterestPct: 1,
  bankTU: 2
} as const;

export const CRYPTO = {
  startPrice: 100,
  /** Weekly move drawn uniformly in ±volatilityPct (§2.3). */
  volatilityPct: 40,
  minPrice: 5,
  tradeTU: 2
} as const;

export const LOTTERY = {
  ticketCost: 5,
  jackpot: 2000,
  oddsOneIn: 500,
  maxTicketsPerWeek: 10,
  buyTU: 1
} as const;

// ---------- fun ----------

export const FUN = {
  club: { cost: 40, happiness: 10, tu: 6, location: "theSpot" as LocationId },
  movie: { cost: 25, happiness: 6, tu: 4, location: "theSpot" as LocationId },
  stream: { cost: 10, happiness: 3, tu: 3, location: "home" as LocationId }
} as const;

// ---------- events (§2.6) ----------

export const EVENTS = {
  /** Robbery: chance/week when carrying more than threshold cash. */
  robbery: { cashThreshold: 500, chancePct: 10, losePct: 50 },
  sickness: { chancePctWhenHungry: 25, happinessPenalty: 8, cost: 40 },
  foundWallet: { chancePct: 4, amount: 50 },
  phoneBroke: { chancePct: 3 },
  overtimeBonus: { chancePct: 8, bonusPct: 50 },
  shiftCancelled: { chancePct: 5 },
  layoff: { chancePct: 3, minTier: 3 },
  gadgetSale: { chancePct: 8, discountPct: 30 },
  recession: { chancePct: 4 },
  marketHeat: { chancePct: 10, extraHikePct: 5 },
  /** Cap on personal event cards per player per week (§2.6). */
  maxPersonalEventsPerPlayerPerWeek: 2
} as const;

// ---------- reveal (juiciest-moment picker, spec §4.4) ----------

export const REVEAL = {
  /** Max cards in one week's reveal (global events + player roasts combined). */
  maxCards: 5,
  /** A player's cash swing (₪, gross) must clear this to earn a money roast. */
  cashRoastFloor: 150,
  /** A player's net happiness swing must clear this to earn a mood roast. */
  moodRoastFloor: 8
} as const;

// ---------- goals (§2.7) ----------

export const GOAL_PRESETS: Record<"quick" | "classic" | "marathon", GoalSet> = {
  quick: { netWorth: 3500, happiness: 70, courses: 4, careerTier: 3 },
  classic: { netWorth: 6000, happiness: 80, courses: 8, careerTier: 4 },
  marathon: { netWorth: 15000, happiness: 85, courses: 12, careerTier: 6 }
} as const;

export const DEFAULT_MAX_WEEKS = 30;

// ---------- starting state ----------

export const STARTING = {
  cash: 200,
  bankBalance: 0,
  happiness: HAPPINESS.start,
  housingTier: 0 as HousingTier,
  location: "home" as LocationId,
  jobTier: -1 as const
} as const;
