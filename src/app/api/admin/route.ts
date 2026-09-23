import { NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { getSessionRole } from "@/lib/session";

export async function GET(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) {
    return Response.json({ error: "The control center is not connected yet." }, { status: 503 });
  }
  try {
    const requestedQuestionCursor = request.nextUrl.searchParams.get("questionCursor");
    if (requestedQuestionCursor !== null) {
      const eventPage = await client.query(api.brightflare.getAdminQuestionEvents, {
        secret,
        centerSlug: "little-lantern",
        paginationOpts: { numItems: 50, cursor: requestedQuestionCursor },
      });
      return Response.json({
        questions: eventPage.page.map((event) => ({
          id: event.id,
          question: event.question,
          topicId: event.topicId,
          topicTitle: event.topicTitle,
          askedAt: new Date(event.askedAt).toISOString(),
          outcome: event.outcome,
          sourceStatus: event.sourceStatus,
          isPrivate: event.isPrivate,
        })),
        questionCursor: eventPage.isDone ? null : eventPage.continueCursor,
      });
    }
    const result = await client.query(api.brightflare.getAdmin, {
      secret,
      centerSlug: "little-lantern",
    });
    const topics = result.topics
      .map((topic) => ({
        id: topic.id,
        title: topic.canonicalTitle,
        questionCount: topic.questionCount,
        sessionCount: topic.sessionCount,
        status: topic.status,
        lastAskedAt: new Date(topic.lastAskedAt).toISOString(),
        examples: topic.recentExamples,
      }))
      .sort((left, right) => right.questionCount - left.questionCount);
    const questions = result.recentQuestions.map((event) => ({
      id: event.id,
      question: event.question,
      topicId: event.topicId,
      topicTitle: event.topicTitle,
      askedAt: new Date(event.askedAt).toISOString(),
      outcome: event.outcome,
      sourceStatus: event.sourceStatus,
      isPrivate: event.isPrivate,
    }));
    let questionCursor: string | null = null;
    if (questions.length === 50) {
      const page = await client.query(api.brightflare.getAdminQuestionEvents, {
        secret,
        centerSlug: "little-lantern",
        paginationOpts: { numItems: 50, cursor: null },
      });
      questionCursor = page.isDone ? null : page.continueCursor;
    }
    return Response.json({
      center: { name: result.center.name },
      topics,
      questions,
      questionCursor,
      knowledge: result.knowledge.map((entry) => ({
        ...entry,
        startsAt: entry.startsAt ? new Date(entry.startsAt).toISOString() : null,
        endsAt: entry.endsAt ? new Date(entry.endsAt).toISOString() : null,
        reviewedAt: new Date(entry.reviewedAt).toISOString(),
      })),
      suggestions: topics
        .filter((topic) => topic.status === "needs_answer" || topic.status === "needs_review")
        .slice(0, 3)
        .map((topic) => ({
          id: topic.id,
          title: topic.title,
          reason:
            topic.status === "needs_answer"
              ? "Families are asking and the handbook has no approved answer."
              : "Families are asking for more detail than the current answer provides.",
          questionCount: topic.questionCount,
        })),
    });
  } catch {
    return Response.json({ error: "The control center is unavailable right now." }, { status: 503 });
  }
}
