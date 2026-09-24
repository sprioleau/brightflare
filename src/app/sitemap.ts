import type { MetadataRoute } from "next";
import { getPublicHandbook } from "@/lib/public-handbook";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://brightflare-sprioleau-projects.vercel.app";
  const handbook = await getPublicHandbook();
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/handbook`, changeFrequency: "daily", priority: 0.8 },
    ...(handbook?.entries.map((entry) => ({
      url: `${baseUrl}/handbook/${entry.id}`,
      lastModified: new Date(entry.reviewedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })) ?? []),
  ];
}
