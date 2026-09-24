import { z } from "zod";
import { isPrivateChildQuestion } from "@/lib/question-safety";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1_000),
}).strict();

export const conversationHistorySchema = z.array(historyMessageSchema).max(8).optional();

export type ConversationHistoryMessage = z.infer<typeof historyMessageSchema>;

export function sanitizeConversationHistory(value: unknown): ConversationHistoryMessage[] {
  const parsed = conversationHistorySchema.safeParse(value);
  if (!parsed.success) return [];
  const messages = parsed.data ?? [];

  const isValidPairShape = messages.length % 2 === 0 && messages.every((message, index) =>
    message.role === (index % 2 === 0 ? "user" : "assistant"),
  );
  if (!isValidPairShape) return [];

  const turns: ConversationHistoryMessage[][] = [];
  for (let index = 0; index < messages.length; index += 2) {
    const userMessage = messages[index];
    const assistantMessage = messages[index + 1];
    const hasPrivateChildContent = [userMessage.content, assistantMessage.content].some(isPrivateChildQuestion);
    if (hasPrivateChildContent) continue;
    turns.push([userMessage, assistantMessage]);
  }

  return turns.slice(-4).flat();
}

export function serializeConversationHistory(history: ConversationHistoryMessage[]) {
  return history.map(({ role, content }) => ({ role, content: content.slice(0, 1_000) }));
}
