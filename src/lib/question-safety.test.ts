import { describe, expect, it } from "vitest";
import { isPrivateChildQuestion, makeCanonicalKey, matchExistingTopic, shouldSuppressAnswerDraft } from "./question-safety";

describe("question privacy routing", () => {
  it("requires the private path for a child mention or daily update", () => {
    expect(isPrivateChildQuestion("@child What did the teacher say today?")).toBe(true);
    expect(isPrivateChildQuestion("What did my daughter eat today?")).toBe(true);
  });

  it("keeps general handbook questions available without a family login", () => {
    expect(isPrivateChildQuestion("What is the fever policy for my child?")).toBe(false);
    expect(isPrivateChildQuestion("Are you open on Veterans Day?")).toBe(false);
  });

  it("suppresses provisional answers for private and health questions", () => {
    expect(shouldSuppressAnswerDraft("@child What did Maya eat today?")).toBe(true);
    expect(shouldSuppressAnswerDraft("What is the center's fever policy?")).toBe(true);
    expect(shouldSuppressAnswerDraft("Are you open on Veterans Day?")).toBe(false);
  });

  it("groups wording variants under a stable topic key", () => {
    expect(makeCanonicalKey("Are we open on Labor Day?"))
      .toBe("are-we-open-on-labor-day");
  });

  it("reuses an existing demand topic for semantically similar questions", () => {
    expect(matchExistingTopic("Meals on Staff Learning Day", ["Lunch on the October staff learning day", "Allergy care plans"]))
      .toBe("Lunch on the October staff learning day");
    expect(matchExistingTopic("How much is tuition?", ["Lunch on the October staff learning day"]))
      .toBeNull();
  });
});
