import { z } from "zod";

export const generatedAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(700),
  sourceIds: z.array(z.string()).max(3),
  needsStaff: z.boolean(),
  canonicalTitle: z.string().trim().min(4).max(100),
});

export type AnswerSource = {
  id: string;
  sourceLabel: string;
  reviewedAt: number;
};

export function validateGroundedAnswer(
  answer: z.infer<typeof generatedAnswerSchema>,
  sources: AnswerSource[],
) {
  const validSources = answer.sourceIds
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is AnswerSource => source !== undefined);
  const hasInvalidCitation = validSources.length !== answer.sourceIds.length;
  const hasEnoughEvidence = validSources.length > 0 && !hasInvalidCitation;

  if (!hasEnoughEvidence) {
    return {
      status: "handoff" as const,
      answer: "I couldn't verify that from the current center handbook. Please ask the front desk team so you get the right answer.",
      sourceId: "",
      sourceLabel: "Front desk team",
      reviewedAt: new Date().toISOString(),
    };
  }

  return {
    status: answer.needsStaff ? "handoff" as const : "answered" as const,
    answer: answer.needsStaff
      ? `${answer.answer} Please check with the front desk team about your situation.`
      : answer.answer,
    sourceId: validSources.map((source) => source.id).join(","),
    sourceLabel: validSources.map((source) => source.sourceLabel).join(" · "),
    reviewedAt: new Date(Math.min(...validSources.map((source) => source.reviewedAt))).toISOString(),
  };
}
