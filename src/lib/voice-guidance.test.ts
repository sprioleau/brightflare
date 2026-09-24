import { describe, expect, it } from "vitest";
import { hasForbiddenTerm } from "./voice-guidance";

describe("center voice guidance", () => {
  it("blocks forbidden standalone phrases without blocking unrelated words", () => {
    expect(hasForbiddenTerm("Ask your kiddos about lunch.", ["kiddos"])).toBe(true);
    expect(hasForbiddenTerm("Check the front desk team.", ["front desk team"])).toBe(true);
    expect(hasForbiddenTerm("We know the center hours.", ["no"])).toBe(false);
  });
});
