import type { NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { getSessionRole, isSameOrigin } from "@/lib/session";

const announcementSchema = z.object({
  title: z.string().trim().max(80),
  message: z.string().trim().max(500),
  isActive: z.boolean(),
}).refine((announcement) => !announcement.isActive || announcement.message.length > 0);

export async function GET(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) {
    return Response.json({ error: "The center is not connected yet." }, { status: 503 });
  }
  try {
    const announcement = await client.query(api.brightflare.getCenterAnnouncement, {
      secret,
      centerSlug: "little-lantern",
    });
    return Response.json(announcement);
  } catch {
    return Response.json({ error: "The center announcement is unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Enter an announcement message before turning it on." }, { status: 400 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) {
    return Response.json({ error: "The center is not connected yet." }, { status: 503 });
  }
  try {
    await client.mutation(api.brightflare.saveCenterAnnouncement, {
      ...parsed.data,
      secret,
      centerSlug: "little-lantern",
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "The center announcement could not be saved." }, { status: 503 });
  }
}
