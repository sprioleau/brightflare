import type { NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { getSessionRole, isSameOrigin } from "@/lib/session";

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  hours: z.string().trim().min(5).max(180),
  tagline: z.string().trim().min(3).max(160),
  timezone: z.string().trim().min(3).max(80),
  handbookLabel: z.string().trim().min(3).max(120),
  websiteUrl: z.union([z.literal(""), z.url().max(500)]),
  tone: z.string().trim().min(3).max(160),
  audience: z.string().trim().min(3).max(160),
  preferredTerms: z.array(z.string().trim().min(1).max(80)).max(30),
  forbiddenTerms: z.array(z.string().trim().min(1).max(80)).max(30),
  glossary: z.array(z.object({ term: z.string().trim().min(1).max(80), definition: z.string().trim().min(1).max(200) })).max(30),
});

export async function GET(request: NextRequest) {
  if (getSessionRole(request) !== "admin") return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) return Response.json({ error: "The center is not connected yet." }, { status: 503 });
  try {
    const settings = await client.query(api.brightflare.getCenterSettings, { secret, centerSlug: "little-lantern" });
    return Response.json({ ...settings, glossary: settings.glossary.map(({ term, meaning }) => ({ term, definition: meaning })) });
  } catch {
    return Response.json({ error: "Center settings are unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (getSessionRole(request) !== "admin") return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Review the center details and agent guidance." }, { status: 400 });
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) return Response.json({ error: "The center is not connected yet." }, { status: 503 });
  try {
    await client.mutation(api.brightflare.saveCenterSettings, {
      ...parsed.data, secret, centerSlug: "little-lantern",
      glossary: parsed.data.glossary.map(({ term, definition }) => ({ term, meaning: definition })),
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Center settings could not be saved." }, { status: 503 });
  }
}
