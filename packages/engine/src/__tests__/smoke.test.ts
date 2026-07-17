import { describe, expect, it } from "vitest";
import { TIME_UNITS_PER_WEEK } from "../index";

describe("engine package wiring", () => {
  it("exposes balance config", () => {
    expect(TIME_UNITS_PER_WEEK).toBe(60);
  });
});
