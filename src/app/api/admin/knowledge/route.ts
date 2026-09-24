import { NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { centerDateBoundary } from "@/lib/center-time";
import { getSessionRole, isSameOrigin } from "@/lib/session";

const knowledgeSchema = z.object({
  id: z.string().optional().nullable(),
  topicId: z.string().optional().nullable(),
  title: z.string().trim().min(5).max(90),
  shortAnswer: z.string().trim().min(8).max(180),
  answer: z.string().trim().min(12).max(2000),
  sourceLabel: z.string().trim().min(3).max(120),
  sourceType: z.enum(["handbook", "center_update", "staff_policy", "other_approved_source"]).optional(),
  category: z.string().trim().min(2).max(60),
  isFeatured: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  startsAt: z.iso.date().nullable().optional(),
  endsAt: z.iso.date().nullable().optional(),
  status: z.enum(["published", "draft"]).default("published"),
});

export async function POST(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = knowledgeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Review the FAQ title, answer, source, and dates." }, { status: 400 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) {
    return Response.json({ error: "The handbook is not connected yet." }, { status: 503 });
  }
  const { topicId, startsAt, endsAt, ...entry } = parsed.data;
  if (startsAt && endsAt && startsAt > endsAt) {
    return Response.json({ error: "The end date must follow the start date." }, { status: 400 });
  }
  try {
    const id = await client.mutation(api.brightflare.upsertKnowledge, {
      ...entry,
      id: (entry.id as Id<"knowledge"> | undefined) ?? null,
      topicId: topicId ? topicId as Id<"topics"> : undefined,
      startsAt: startsAt ? centerDateBoundary(startsAt, false) : undefined,
      endsAt: endsAt ? centerDateBoundary(endsAt, true) : undefined,
      reviewedAt: Date.now(),
      centerSlug: "little-lantern",
      secret,
    });
    return Response.json({ id });
  } catch {
    console.error("Brightflare handbook save failed");
    return Response.json({ error: "The FAQ could not be saved. Please try again." }, { status: 500 });
  }
}
