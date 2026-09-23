import { api } from "../../../../convex/_generated/api";
import { getConvexServerClient } from "@/lib/convex-server";

export async function GET() {
  const client = getConvexServerClient();
  if (!client) {
    return Response.json({ error: "The center handbook is not connected yet." }, { status: 503 });
  }

  try {
    const result = await client.query(api.brightflare.getFrontDesk, {
      centerSlug: "little-lantern",
      now: Date.now(),
    });
    return Response.json({
      center: {
        name: result.center.name,
        tagline: "A little more clarity in every day.",
        hours: "Monday–Friday · 7:30 AM–5:30 PM",
        handbookLabel: result.center.handbookLabel,
      },
      faqs: [...result.featured, ...result.evergreen].map((faq) => ({
        ...faq,
        reviewedAt: new Date(faq.reviewedAt).toISOString(),
      })),
    });
  } catch {
    return Response.json({ error: "The center handbook is unavailable right now." }, { status: 503 });
  }
}
