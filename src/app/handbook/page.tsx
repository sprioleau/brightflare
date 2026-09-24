import type { Metadata } from "next";
import { HandbookBrowser } from "@/app/handbook/handbook-browser";
import { getPublicHandbook } from "@/lib/public-handbook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Family handbook | brightflare",
  description: "Published answers and policies from Little Lantern Learning Center.",
};

export default async function HandbookPage() {
  const handbook = await getPublicHandbook();

  return <HandbookBrowser
    centerName={handbook?.center.name ?? "Little Lantern Learning Center"}
    centerHours={handbook?.center.hours}
    handbookLabel={handbook?.center.handbookLabel || "Family handbook"}
    entries={handbook?.entries ?? []}
    selectedEntryId={handbook?.entries[0]?.id}
    isUnavailable={!handbook}
  />;
}
