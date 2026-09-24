import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HandbookBrowser } from "@/app/handbook/handbook-browser";
import { getPublicHandbook } from "@/lib/public-handbook";

export const dynamic = "force-dynamic";

type HandbookSectionProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: HandbookSectionProps): Promise<Metadata> {
  const { id } = await params;
  const handbook = await getPublicHandbook();
  const entry = handbook?.entries.find((item) => item.id === id);

  return {
    title: entry ? `${entry.title} | ${handbook?.center.handbookLabel ?? "Family handbook"}` : "Handbook section | brightflare",
    description: entry?.shortAnswer,
  };
}

export default async function HandbookSectionPage({ params }: HandbookSectionProps) {
  const { id } = await params;
  const handbook = await getPublicHandbook();
  const entry = handbook?.entries.find((item) => item.id === id);
  if (!handbook || !entry) notFound();

  return <HandbookBrowser
    centerName={handbook.center.name}
    centerHours={handbook.center.hours}
    handbookLabel={handbook.center.handbookLabel || "Family handbook"}
    entries={handbook.entries}
    selectedEntryId={entry.id}
  />;
}
