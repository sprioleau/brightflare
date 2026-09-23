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
    return Response.json({
      center: { name: result.center.name },
      topics,
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
