import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { getPublicHandbook } from "@/lib/public-handbook";

export const dynamic = "force-dynamic";

type HandbookSectionProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: HandbookSectionProps): Promise<Metadata> {
  const { id } = await params;
  const handbook = await getPublicHandbook();
  const entry = handbook?.entries.find((item) => item.id === id);
  return {
    title: entry ? `${entry.title} | ${handbook?.center.name} handbook` : "Handbook section | brightflare",
    description: entry?.shortAnswer,
  };
}

export default async function HandbookSectionPage({ params }: HandbookSectionProps) {
  const { id } = await params;
  const handbook = await getPublicHandbook();
  const entry = handbook?.entries.find((item) => item.id === id);
  if (!handbook || !entry) notFound();
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
      <Link href="/" aria-label="Brightflare family desk"><Logo size={32} /></Link>
      <Link href="/handbook" className="text-sm font-medium text-primary hover:underline">Family handbook</Link>
    </div></header>
    <article className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/handbook" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft aria-hidden="true" className="size-4" />All sections</Link>
      <p className="mt-10 text-sm text-muted-foreground">{handbook.center.name} · {entry.category}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{entry.title}</h1>
      <p className="mt-5 text-lg font-medium leading-8">{entry.shortAnswer}</p>
      <div className="mt-8 border-t pt-8"><p className="whitespace-pre-wrap text-base leading-8">{entry.answer}</p></div>
      <div className="mt-10 flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
        <BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <div><p className="font-medium">Source: {entry.sourceLabel}</p><p className="mt-1 text-muted-foreground">Reviewed {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(entry.reviewedAt))}</p></div>
      </div>
    </article>
  </main>;
}
