import { isStepCount, Output, ToolLoopAgent, tool } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { getGeminiModel, getGeminiOverloadFallbackModel, isGeminiOverloaded } from "@/lib/ai-model";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { getSessionRole, isSameOrigin } from "@/lib/session";

const inputSchema = z.object({
  mode: z.enum(["title", "seasonal", "knowledge"]),
  text: z.string().trim().max(500).optional(),
  topicId: z.string().optional(),
});

const outputSchema = z.object({ suggestions: z.array(z.string().trim().min(4).max(500)).min(1).max(4) });

export async function POST(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.mode !== "seasonal" && !parsed.data.text)) {
    return Response.json({ error: "Choose a task and provide the text to work from." }, { status: 400 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  const model = getGeminiModel();
  if (!client || !secret || !model) {
    return Response.json({ error: "The admin assistant is not connected yet." }, { status: 503 });
  }

  const agentOptions = {
    output: Output.object({ schema: outputSchema }),
    stopWhen: isStepCount(5),
    maxRetries: 1,
    instructions: "You help center staff draft FAQ content. You may suggest edits but never publish or change the handbook. Always use the provided tools to check center evidence before making a claim about policy, schedules, or historical demand. Do not fabricate a policy. If no approved source answers a topic, suggest a concise question for staff to answer and clearly say staff confirmation is needed. Never include a child's private information. Return only useful short suggestions. For titles, each suggestion must fit within 65 characters.",
    tools: {
      inspectHandbook: tool({
        description: "Read current approved center handbook answers before drafting an FAQ answer or shortening a policy title.",
        inputSchema: z.object({}),
        execute: async () => client.query(api.brightflare.getKnowledgeForAsk, {
          secret,
          centerSlug: "little-lantern",
          now: Date.now(),
        }),
      }),
      inspectHandbookEntry: tool({
        description: "Find current published handbook entries related to a specific topic and return their approved answer and source details. Use this for focused policy checks.",
        inputSchema: z.object({ topic: z.string().trim().min(2).max(120) }),
        execute: async ({ topic }) => {
          const entries = await client.query(api.brightflare.getKnowledgeForAsk, {
            secret,
            centerSlug: "little-lantern",
            now: Date.now(),
          });
          const query = topic.toLocaleLowerCase();
          return entries
            .map((entry) => ({
              ...entry,
              relevance: `${entry.title} ${entry.answer} ${entry.sourceLabel}`.toLocaleLowerCase().includes(query),
            }))
            .filter((entry) => entry.relevance)
            .slice(0, 5)
            .map(({ relevance: _relevance, ...entry }) => entry);
        },
      }),
      inspectRecentPublicQuestions: tool({
        description: "Read recent public family questions only, excluding private child questions. Use these to understand recent wording and demand.",
        inputSchema: z.object({}),
        execute: async () => {
          const result = await client.query(api.brightflare.getAdminQuestionEvents, {
            secret,
            centerSlug: "little-lantern",
            paginationOpts: { numItems: 50, cursor: null },
          });
          return result.page
            .filter((event) => !event.isPrivate)
            .slice(0, 12)
            .map(({ id, question, topicTitle, askedAt, outcome, sourceStatus }) => ({
              id,
              question,
              topicTitle,
              askedAt,
              outcome,
              sourceStatus,
            }));
        },
      }),
      inspectSeasonalHistory: tool({
        description: "Read previous years' family question counts for the chosen calendar month.",
        inputSchema: z.object({ month: z.number().int().min(1).max(12) }),
        execute: async ({ month }) => client.query(api.brightflare.getSeasonalHistory, {
          secret,
          centerSlug: "little-lantern",
          month,
        }),
      }),
      inspectQuestionTrends: tool({
        description: "Read grouped family question trends, including unanswered topics and example phrasings.",
        inputSchema: z.object({}),
        execute: async () => {
          const data = await client.query(api.brightflare.getAdmin, { secret, centerSlug: "little-lantern" });
          return data.topics.map((topic) => ({
            id: topic.id,
            title: topic.canonicalTitle,
            questionCount: topic.questionCount,
            sessionCount: topic.sessionCount,
            status: topic.status,
            examples: topic.recentExamples,
          }));
        },
      }),
    },
  };

  const currentMonth = new Date().getUTCMonth() + 1;
  const prompt = parsed.data.mode === "seasonal"
    ? `Use inspectSeasonalHistory for month ${currentMonth} and inspectQuestionTrends. Suggest up to three seasonal FAQ titles for the next few weeks. Base them on retrieved historical counts and avoid topics already answered in the current handbook.`
    : parsed.data.mode === "title"
      ? `Use inspectHandbook. Suggest two or three plain-language FAQ titles of at most 65 characters for this staff draft: ${JSON.stringify(parsed.data.text)}. Preserve its meaning.`
      : `Use inspectHandbookEntry for the investigated topic, inspectHandbook for broader context, inspectRecentPublicQuestions for recent family wording, and inspectQuestionTrends. Topic ID: ${parsed.data.topicId || "none"}. Staff is investigating: ${JSON.stringify(parsed.data.text)}. Suggest a short answer draft only when directly supported by a current approved source. Otherwise, suggest the exact policy detail staff needs to confirm before publishing.`;
  try {
    const { output } = await new ToolLoopAgent({ model, ...agentOptions }).generate({ prompt });
    return Response.json(output);
  } catch (error) {
    const fallbackModel = getGeminiOverloadFallbackModel();
    if (fallbackModel && isGeminiOverloaded(error)) {
      try {
        const { output } = await new ToolLoopAgent({ model: fallbackModel, ...agentOptions }).generate({ prompt });
        return Response.json(output);
      } catch {
        return Response.json({ error: "The assistant could not prepare a suggestion. Please try again." }, { status: 503 });
      }
    }
    return Response.json({ error: "The assistant could not prepare a suggestion. Please try again." }, { status: 503 });
  }
}
