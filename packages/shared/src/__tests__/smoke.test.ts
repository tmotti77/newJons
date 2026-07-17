import { describe, expect, it } from "vitest";
import { displayNameSchema, gameModeSchema } from "../index";

describe("shared package wiring", () => {
  it("validates a display name", () => {
    expect(displayNameSchema.safeParse("Dana").success).toBe(true);
    expect(displayNameSchema.safeParse("").success).toBe(false);
  });

  it("validates game modes", () => {
    expect(gameModeSchema.safeParse("live").success).toBe(true);
    expect(gameModeSchema.safeParse("nope").success).toBe(false);
  });
});
