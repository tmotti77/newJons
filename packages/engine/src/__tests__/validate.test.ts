import { describe, expect, it } from "vitest";
import { EDUCATION, FOOD, ITEMS, TIME_UNITS_PER_WEEK, WORK } from "../config/balance";
import { initialGameState } from "../state";
import type { Action, GameState } from "../types";
import { validatePlan } from "../validate";

function freshGame(players = 2): GameState {
  return initialGameState(12345, players);
}

function codes(state: GameState, plan: Action[], slot = 0): string[] {
  return validatePlan(state, slot, plan).errors.map((e) => e.code);
}

describe("validatePlan — basics", () => {
  it("accepts an empty plan", () => {
    expect(validatePlan(freshGame(), 0, []).ok).toBe(true);
  });

  it("rejects unknown player slot", () => {
    const r = validatePlan(freshGame(), 9, []);
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.code).toBe("err.player.unknown");
  });

  it("accepts a simple valid week: travel → eat → rest", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "basic" },
      { type: "rest", tu: 10 }
    ];
    const r = validatePlan(state, 0, plan);
    expect(r.ok).toBe(true);
    expect(r.projected?.cash).toBe(200 - FOOD.basicCost);
  });
});

describe("validatePlan — TU budget", () => {
  it("rejects TU overrun", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "rest", tu: TIME_UNITS_PER_WEEK + 1 }])).toContain(
      "err.tu.overrun"
    );
  });

  it("counts travel TU toward budget", () => {
    const state = freshGame();
    // travel home→college is cross-zone (4 TU) then rest 57 overruns
    expect(
      codes(state, [
        { type: "travel", to: "college" },
        { type: "rest", tu: 57 }
      ])
    ).toContain("err.tu.overrun");
  });
});

describe("validatePlan — cash floor", () => {
  it("rejects mid-plan cash underflow", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "college" },
      { type: "study", courseTrack: "tech" },
      { type: "study", courseTrack: "tech" },
      { type: "study", courseTrack: "tech" },
      { type: "study", courseTrack: "tech" },
      { type: "study", courseTrack: "tech" } // 5 x ₪50 = 250 > 200 start
    ];
    expect(codes(state, plan)).toContain("err.cash.insufficient");
  });

  it("allows spending money earned by selling first", () => {
    const state = freshGame();
    state.players[0]!.items.push("laptop");
    state.players[0]!.cash = 0;
    const plan: Action[] = [
      { type: "travel", to: "flipIt" },
      { type: "sell", item: "laptop" }, // +250
      { type: "travel", to: "college" },
      { type: "study", courseTrack: "tech" }
    ];
    expect(validatePlan(state, 0, plan).ok).toBe(true);
  });
});

describe("validatePlan — location context", () => {
  it("rejects working at the wrong location", () => {
    const state = freshGame();
    state.players[0]!.jobTier = 1; // Burger Barn crew
    expect(codes(state, [{ type: "work", tu: 8 }])).toContain("err.work.wrongLocation");
  });

  it("rejects studying outside college without laptop", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "study", courseTrack: "tech" }])).toContain(
      "err.study.wrongLocation"
    );
  });

  it("allows studying at home with a laptop (discounted TU)", () => {
    const state = freshGame();
    state.players[0]!.items.push("laptop");
    const r = validatePlan(state, 0, [{ type: "study", courseTrack: "tech" }]);
    expect(r.ok).toBe(true);
    expect(r.projected?.tuUsed).toBe(EDUCATION.courseTU - EDUCATION.laptopTUDiscount);
  });

  it("rejects buying an item at the wrong store", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "buy", item: "laptop" }])).toContain("err.buy.wrongLocation");
  });

  it("rejects travel to the same place", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "travel", to: "home" }])).toContain("err.travel.samePlace");
  });
});

describe("validatePlan — work rules", () => {
  it("rejects shifts under the minimum", () => {
    const state = freshGame();
    state.players[0]!.jobTier = 1;
    state.players[0]!.location = "burgerBarn";
    expect(codes(state, [{ type: "work", tu: WORK.minShiftTU - 1 }])).toContain(
      "err.work.shiftTooShort"
    );
  });

  it("rejects exceeding the weekly work cap", () => {
    const state = freshGame();
    state.players[0]!.jobTier = 1;
    state.players[0]!.location = "burgerBarn";
    expect(
      codes(state, [
        { type: "work", tu: 30 },
        { type: "work", tu: 20 }
      ])
    ).toContain("err.work.weeklyCap");
  });

  it("gig work requires a phone", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "work", tu: 8 }])).toContain("err.work.needPhone");
  });

  it("gig work with phone works from anywhere", () => {
    const state = freshGame();
    state.players[0]!.items.push("phone");
    expect(validatePlan(state, 0, [{ type: "work", tu: 8 }]).ok).toBe(true);
  });

  it("enforces dress code while working outfit-gated jobs", () => {
    const state = freshGame();
    state.players[0]!.jobTier = 3;
    state.players[0]!.location = "careerHub";
    expect(codes(state, [{ type: "work", tu: 8 }])).toContain("err.work.dressCode");
  });
});

describe("validatePlan — job applications", () => {
  it("rejects applying without requirements", () => {
    const state = freshGame();
    state.players[0]!.location = "careerHub";
    expect(codes(state, [{ type: "applyJob", tier: 3 }])).toContain("err.job.courses");
  });

  it("rejects applying at the wrong place", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "applyJob", tier: 1 }])).toContain("err.apply.wrongLocation");
  });

  it("accepts a qualified application (courses + outfit + location)", () => {
    const state = freshGame();
    const p = state.players[0]!;
    p.courses.business = 4;
    p.outfits.push({ outfit: "business", weeksLeft: 5 });
    p.location = "careerHub";
    expect(validatePlan(state, 0, [{ type: "applyJob", tier: 3 }]).ok).toBe(true);
  });

  it("checks experience weeks", () => {
    const state = freshGame();
    const p = state.players[0]!;
    p.courses.business = 2;
    p.location = "careerHub";
    p.weeksWorked = 1;
    expect(codes(state, [{ type: "applyJob", tier: 2 }])).toContain("err.job.experience");
  });

  it("buying the outfit earlier in the same plan satisfies dress code", () => {
    const state = freshGame();
    const p = state.players[0]!;
    p.courses.business = 4;
    p.cash = 500;
    const plan: Action[] = [
      { type: "travel", to: "dressCode" },
      { type: "buyOutfit", outfit: "business" },
      { type: "travel", to: "careerHub" },
      { type: "applyJob", tier: 3 }
    ];
    expect(validatePlan(state, 0, plan).ok).toBe(true);
  });
});

describe("validatePlan — shopping & eating", () => {
  it("rejects buying an item twice", () => {
    const state = freshGame();
    state.players[0]!.cash = 1000;
    const plan: Action[] = [
      { type: "travel", to: "gadgetCity" },
      { type: "buy", item: "phone" },
      { type: "buy", item: "phone" }
    ];
    expect(codes(state, plan)).toContain("err.buy.alreadyOwned");
  });

  it("used goods at Flip It cost 70%", () => {
    const state = freshGame();
    const p = state.players[0]!;
    const laptop = ITEMS.find((i) => i.id === "laptop")!;
    p.cash = Math.floor((laptop.price * 70) / 100); // exactly used price
    const plan: Action[] = [
      { type: "travel", to: "flipIt" },
      { type: "buy", item: "laptop" }
    ];
    expect(validatePlan(state, 0, plan).ok).toBe(true);
  });

  it("rejects selling something you don't own", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "flipIt" },
      { type: "sell", item: "tv" }
    ];
    expect(codes(state, plan)).toContain("err.sell.notOwned");
  });

  it("bulk food requires a fridge", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "bulk" }
    ];
    expect(codes(state, plan)).toContain("err.eat.needFridge");
  });

  it("rejects eating twice", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "basic" },
      { type: "eat", kind: "basic" }
    ];
    expect(codes(state, plan)).toContain("err.eat.alreadyAte");
  });

  it("delivery only from home", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "delivery" }
    ];
    expect(codes(state, plan)).toContain("err.eat.wrongLocation");
  });
});

describe("validatePlan — bank, crypto, lottery, rent", () => {
  it("bank ops require being at the bank", () => {
    const state = freshGame();
    expect(codes(state, [{ type: "bank", op: "deposit", amount: 50 }])).toContain(
      "err.bank.wrongLocation"
    );
  });

  it("rejects withdrawing more than balance", () => {
    const state = freshGame();
    state.players[0]!.location = "bank";
    expect(codes(state, [{ type: "bank", op: "withdraw", amount: 50 }])).toContain(
      "err.bank.insufficientBalance"
    );
  });

  it("rejects non-positive amounts", () => {
    const state = freshGame();
    state.players[0]!.location = "bank";
    expect(codes(state, [{ type: "bank", op: "deposit", amount: 0 }])).toContain(
      "err.bank.badAmount"
    );
    expect(codes(state, [{ type: "bank", op: "deposit", amount: -5 }])).toContain(
      "err.bank.badAmount"
    );
  });

  it("rejects selling crypto you don't hold", () => {
    const state = freshGame();
    state.players[0]!.location = "bank";
    expect(codes(state, [{ type: "crypto", op: "sell", amount: 100 }])).toContain(
      "err.crypto.insufficientUnits"
    );
  });

  it("caps lottery tickets per week", () => {
    const state = freshGame();
    state.players[0]!.location = "quickMart";
    expect(codes(state, [{ type: "lottery", tickets: 99 }])).toContain("err.lottery.badCount");
  });

  it("rejects paying rent twice", () => {
    const state = freshGame();
    state.players[0]!.cash = 1000;
    const plan: Action[] = [
      { type: "travel", to: "rentALord" },
      { type: "payRent" },
      { type: "payRent" }
    ];
    expect(codes(state, plan)).toContain("err.rent.alreadyPaid");
  });

  it("evicted players must re-deposit (moveApartment), not payRent", () => {
    const state = freshGame();
    state.players[0]!.evicted = true;
    state.players[0]!.cash = 1000;
    const plan: Action[] = [
      { type: "travel", to: "rentALord" },
      { type: "payRent" }
    ];
    expect(codes(state, plan)).toContain("err.rent.evicted");
    const movePlan: Action[] = [
      { type: "travel", to: "rentALord" },
      { type: "moveApartment", tier: 0 }
    ];
    expect(validatePlan(state, 0, movePlan).ok).toBe(true);
  });
});

describe("validatePlan — error indexing", () => {
  it("reports the failing action index", () => {
    const state = freshGame();
    const plan: Action[] = [
      { type: "travel", to: "quickMart" },
      { type: "eat", kind: "basic" },
      { type: "sell", item: "tv" } // wrong location AND not owned → index 2
    ];
    const r = validatePlan(state, 0, plan);
    expect(r.ok).toBe(false);
    expect(r.errors[0]?.index).toBe(2);
  });
});
