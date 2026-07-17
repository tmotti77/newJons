/**
 * Core engine types (DEV_PLAN §3.10).
 * Pure data — no methods, fully JSON-serializable so PlayerState can live
 * in the game_players.state jsonb column unchanged.
 */

// ---------- world identifiers ----------

export type LocationId =
  | "home"
  | "burgerBarn"
  | "college"
  | "gadgetCity"
  | "flipIt"
  | "dressCode"
  | "careerHub"
  | "bank"
  | "quickMart"
  | "theSpot"
  | "rentALord";

export type ItemId = "phone" | "tv" | "console" | "fridge" | "laptop" | "bike" | "car";

export type OutfitId = "casual" | "business" | "luxury";

export type Track = "business" | "tech" | "trade";

export type JobTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type HousingTier = 0 | 1 | 2;

// ---------- actions (a plan is an ordered Action[]) ----------

export type Action =
  | { type: "travel"; to: LocationId }
  | { type: "work"; tu: number } // at current job's location (gig works anywhere w/ phone)
  | { type: "study"; courseTrack: Track } // college, or home w/ laptop
  | { type: "buy"; item: ItemId } // context: current location
  | { type: "buyOutfit"; outfit: OutfitId } // at Dress Code
  | { type: "sell"; item: ItemId } // at Flip It
  | { type: "eat"; kind: "basic" | "bulk" | "delivery" }
  | { type: "bank"; op: "deposit" | "withdraw"; amount: number }
  | { type: "crypto"; op: "buy" | "sell"; amount: number }
  | { type: "lottery"; tickets: number }
  | { type: "fun"; kind: "club" | "movie" | "stream" }
  | { type: "payRent" }
  | { type: "moveApartment"; tier: HousingTier }
  | { type: "applyJob"; tier: JobTier }
  | { type: "rest"; tu: number };

export type ActionType = Action["type"];

// ---------- player & game state ----------

export interface OwnedOutfit {
  outfit: OutfitId;
  /** Weeks of wear remaining; outfit is unusable at 0 (§2.3 Dress Code). */
  weeksLeft: number;
}

export interface PlayerState {
  /** Stable seat index 0..7 — also the RNG lane. */
  slot: number;
  cash: number;
  bankBalance: number;
  /** Units of CryptoRocket held (value = units * cryptoPrice on GameState). */
  cryptoUnits: number;
  happiness: number;
  /** Completed courses per track. */
  courses: Record<Track, number>;
  /** Current job tier; -1 = unemployed (gig always available). */
  jobTier: JobTier | -1;
  /** Total weeks in which the player worked ≥1 TU (promotion requirement). */
  weeksWorked: number;
  housingTier: HousingTier;
  /** Consecutive missed rent payments; 2 → eviction (§2.4). */
  missedRentWeeks: number;
  /** True if evicted to Shelter; must re-deposit to rent again. */
  evicted: boolean;
  /** Whether the player ate this week (checked at resolve). */
  fedThisWeek: boolean;
  /** Weeks of bulk food remaining in the fridge. */
  bulkFoodWeeks: number;
  items: ItemId[];
  outfits: OwnedOutfit[];
  location: LocationId;
  /** Lottery tickets bought this week (consumed at resolve). */
  lotteryTickets: number;
  /** True once the player has satisfied all four goals (game over check). */
  hasWon: boolean;
}

export interface GoalSet {
  netWorth: number;
  happiness: number;
  courses: number;
  careerTier: JobTier;
}

export interface GameSettings {
  goals: GoalSet;
  maxWeeks: number;
  planTimerSeconds: number;
}

export interface GameState {
  seed: number;
  week: number;
  settings: GameSettings;
  /** Current global rent multiplier (starts 1, hikes per §2.4). */
  rentMultiplier: number;
  /** Current CryptoRocket price (starts at balance.crypto.startPrice). */
  cryptoPrice: number;
  players: PlayerState[];
}

// ---------- resolution output ----------

/**
 * One human-readable line of "what happened", used to build the reveal
 * screen. `key` is an i18n key; params fill the template. Amounts are
 * signed deltas where relevant.
 */
export interface LedgerLine {
  key: string;
  params?: Record<string, string | number>;
  cashDelta?: number;
  happinessDelta?: number;
}

export type EventCategory = "personal" | "economy" | "social" | "jackpot";

export interface EventCard {
  id: string;
  category: EventCategory;
  /** i18n key for the card text. */
  key: string;
  params?: Record<string, string | number>;
  /** Slots of affected players (empty = global/economy card). */
  affectedSlots: number[];
}

export interface GoalProgress {
  netWorth: number;
  happiness: number;
  courses: number;
  careerTier: number;
  /** 0..1 per goal, and combined weighted score. */
  pct: { netWorth: number; happiness: number; courses: number; careerTier: number };
  score: number;
  achievedAll: boolean;
}

export interface PlayerWeekResult {
  slot: number;
  stateBefore: PlayerState;
  stateAfter: PlayerState;
  ledger: LedgerLine[];
  eventCards: EventCard[];
  goalProgress: GoalProgress;
}

export interface WeekResult {
  week: number;
  players: PlayerWeekResult[];
  /** Global cards (rent hikes, crypto moves, recession...). */
  globalEvents: EventCard[];
  /** Slots ordered by weighted score, best first. */
  standings: number[];
  /** Set when a player satisfied all goals this week (§2.7). */
  winnerSlot?: number;
  /** New state to persist (players updated, week+1, rent/crypto moved). */
  nextState: GameState;
}

// ---------- validation ----------

export interface ActionError {
  /** Index into the submitted plan. */
  index: number;
  /** Machine-readable error code (also used as i18n key). */
  code: string;
  params?: Record<string, string | number>;
}

export interface ValidationResult {
  ok: boolean;
  errors: ActionError[];
  /** Projected end-of-plan snapshot for client UX (TU left, cash...). */
  projected?: {
    tuUsed: number;
    cash: number;
    location: LocationId;
  };
}
