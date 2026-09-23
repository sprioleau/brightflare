import { describe, expect, it } from "vitest";
import { validateGroundedAnswer } from "./grounding";

const sources = [{ id: "policy-1", sourceLabel: "Family Handbook · Hours", reviewedAt: Date.UTC(2026, 8, 1) }];

describe("answer evidence", () => {
  it("shows a supported answer with its actual source", () => {
    const result = validateGroundedAnswer({
      answer: "The center closes at 5:30 PM.",
      sourceIds: ["policy-1"],
      needsStaff: false,
      canonicalTitle: "What are the center hours?",
    }, sources);
    expect(result.status).toBe("answered");
    expect(result.sourceLabel).toBe("Family Handbook · Hours");
  });

  it("hands off when the model cites an unknown source", () => {
    const result = validateGroundedAnswer({
      answer: "The center is open on every holiday.",
      sourceIds: ["made-up-source"],
      needsStaff: false,
      canonicalTitle: "Are you open on holidays?",
    }, sources);
    expect(result.status).toBe("handoff");
    expect(result.answer).not.toContain("every holiday");
  });
});
