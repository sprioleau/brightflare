import { describe, expect, it } from "vitest";
import { findRelevantSources, type SearchableSource } from "./source-search";

const sources: SearchableSource[] = [
  { id: "hours", sourceLabel: "Family Handbook · Hours", reviewedAt: 1, text: "Open Monday through Friday from 7:30 to 5:30." },
  { id: "calendar", sourceLabel: "Center update · October calendar", reviewedAt: 2, text: "The center is open on the October staff learning day." },
  { id: "allergy", sourceLabel: "Family Handbook · Allergies", reviewedAt: 3, text: "Share the allergy care plan with the office." },
];

describe("source search for the answer agent", () => {
  it("prioritizes a dated center update for a matching calendar question", () => {
    expect(findRelevantSources(sources, "October staff learning day")[0]?.id).toBe("calendar");
  });

  it("returns only sources in the caller's authorized set", () => {
    expect(findRelevantSources(sources.slice(0, 1), "allergy care plan")).toEqual([]);
  });
});
