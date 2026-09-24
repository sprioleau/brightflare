import { api } from "../../convex/_generated/api";
import { getConvexServerClient } from "@/lib/convex-server";

export async function getPublicHandbook() {
  const client = getConvexServerClient();
  if (!client) return null;
  try {
    return await client.query(api.brightflare.getPublicHandbook, {
      centerSlug: "little-lantern",
      now: Date.now(),
    });
  } catch {
    return null;
  }
}
