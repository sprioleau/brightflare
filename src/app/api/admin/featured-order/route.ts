import type { NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getConvexServerClient, getConvexServerSecret } from "@/lib/convex-server";
import { getSessionRole, isSameOrigin } from "@/lib/session";

const orderSchema = z.object({ orderedIds: z.array(z.string()).max(8) });

export async function POST(request: NextRequest) {
  if (getSessionRole(request) !== "admin") {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data?.orderedIds ?? []).size !== parsed.data?.orderedIds.length) {
    return Response.json({ error: "Choose up to eight unique featured answers." }, { status: 400 });
  }
  const client = getConvexServerClient();
  const secret = getConvexServerSecret();
  if (!client || !secret) {
    return Response.json({ error: "The handbook is not connected yet." }, { status: 503 });
  }
  try {
    const orderedIds = parsed.data.orderedIds as Id<"knowledge">[];
    await client.mutation(api.brightflare.reorderFeaturedKnowledge, {
      secret,
      centerSlug: "little-lantern",
      orderedIds,
    });
    return Response.json({ orderedIds });
  } catch {
    return Response.json({ error: "The featured answer order could not be saved." }, { status: 400 });
  }
}
