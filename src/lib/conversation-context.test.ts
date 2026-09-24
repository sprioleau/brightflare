import { describe, expect, it } from "vitest";
import { sanitizeConversationHistory } from "./conversation-context";

describe("sanitizeConversationHistory", () => {
  it("keeps at most four complete public turns and allows omitted history", () => {
    const history = Array.from({ length: 4 }, (_, index) => [
      { role: "user" as const, content: `What about day ${index}?` },
      { role: "assistant" as const, content: `Approved answer ${index}.` },
    ]).flat();

    expect(sanitizeConversationHistory(undefined)).toEqual([]);
    expect(sanitizeConversationHistory(history)).toHaveLength(8);
    expect(sanitizeConversationHistory(history)[0]?.content).toBe("What about day 0?");
  });

  it("drops private child turns and malformed or oversized history", () => {
    const mixedHistory = [
      { role: "user" as const, content: "What time do you close?" },
      { role: "assistant" as const, content: "At 5:30 PM." },
      { role: "user" as const, content: "@child what did my daughter eat today?" },
      { role: "assistant" as const, content: "She had lunch." },
    ];

    expect(sanitizeConversationHistory(mixedHistory).map(({ content }) => content)).toEqual([
      "What time do you close?",
      "At 5:30 PM.",
    ]);
    expect(sanitizeConversationHistory([{ role: "assistant", content: "orphan answer" }])).toEqual([]);
    expect(sanitizeConversationHistory([{ role: "user", content: "x".repeat(1_001) }])).toEqual([]);
  });

  it("keeps public child health policy context for a follow-up", () => {
    expect(sanitizeConversationHistory([
      { role: "user", content: "When should my child stay home?" },
      { role: "assistant", content: "Please follow the center's approved illness policy." },
    ])).toHaveLength(2);
  });
});
