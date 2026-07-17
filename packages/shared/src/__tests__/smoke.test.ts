import { describe, expect, it } from "vitest";
import {
  actionSchema,
  createGameRequestSchema,
  displayNameSchema,
  gameModeSchema,
  gameSettingsSchema,
  planSchema
} from "../index";

describe("shared schemas", () => {
  it("validates a display name", () => {
    expect(displayNameSchema.safeParse("Dana").success).toBe(true);
    expect(displayNameSchema.safeParse("").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(21)).success).toBe(false);
  });

  it("validates game modes", () => {
    expect(gameModeSchema.safeParse("live").success).toBe(true);
    expect(gameModeSchema.safeParse("nope").success).toBe(false);
  });

  it("validates actions", () => {
    expect(actionSchema.safeParse({ type: "travel", to: "bank" }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "travel", to: "casino" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "work", tu: 8 }).success).toBe(true);
    expect(actionSchema.safeParse({ type: "work", tu: 0 }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "bank", op: "deposit", amount: 1.5 }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "payRent" }).success).toBe(true);
  });

  it("caps plan length", () => {
    const long = Array.from({ length: 41 }, () => ({ type: "payRent" as const }));
    expect(planSchema.safeParse(long).success).toBe(false);
  });

  it("applies settings defaults", () => {
    const parsed = gameSettingsSchema.parse({});
    expect(parsed.goalPreset).toBe("quick");
    expect(parsed.planTimerSeconds).toBe(90);
    expect(parsed.maxWeeks).toBe(30);
  });

  it("validates create-game request", () => {
    expect(
      createGameRequestSchema.safeParse({
        displayName: "Dana",
        avatar: "a3",
        settings: {}
      }).success
    ).toBe(true);
  });
});
