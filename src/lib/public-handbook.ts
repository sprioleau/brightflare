import { api } from "../../convex/_generated/api";
import { getConvexServerClient } from "@/lib/convex-server";

export async function getPublicHandbook() {
  const client = getConvexServerClient();
  if (!client) return null;

  const now = Date.now();
  const [handbookResult, frontDeskResult] = await Promise.allSettled([
    client.query(api.brightflare.getPublicHandbook, {
      centerSlug: "little-lantern",
      now,
    }),
    client.query(api.brightflare.getFrontDesk, {
      centerSlug: "little-lantern",
      now,
    }),
  ]);

  if (handbookResult.status === "rejected") return null;
  return {
    ...handbookResult.value,
    center: {
      ...handbookResult.value.center,
      hours: frontDeskResult.status === "fulfilled" ? frontDeskResult.value.center.hours : undefined,
    },
  };
}
