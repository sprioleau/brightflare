import { ConvexHttpClient } from "convex/browser";

export function getConvexServerClient(): ConvexHttpClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
  return url ? new ConvexHttpClient(url, { logger: false }) : null;
}

export function getConvexServerSecret(): string | null {
  return process.env.BRIGHTFLARE_SERVER_SECRET || null;
}
