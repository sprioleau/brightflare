import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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

  return <main className="min-h-screen bg-muted/30 text-foreground">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Brightflare family desk"><Logo size={32} /></Link>
        <Link href="/handbook" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{handbook.center.handbookLabel}</Link>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-4 border-b pb-4 sm:mb-6 sm:pb-5">
        <Link href="/handbook" className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary hover:bg-card hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-4" />All sections</Link>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-7">
        <details className="group rounded-xl border bg-card p-3 shadow-sm lg:hidden">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
            <span>Browse {handbook.center.handbookLabel}</span><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <ul aria-label="Handbook sections" className="mt-3 grid gap-1 border-t pt-3">
            {handbook.entries.map((item) => <li key={item.id}>
              <Link href={`/handbook/${item.id}`} aria-current={item.id === entry.id ? "page" : undefined} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary"><ChevronRight aria-hidden="true" className="size-4 shrink-0" />{item.title}</Link>
            </li>)}
          </ul>
        </details>
        <nav aria-label="Handbook sections" className="sticky top-5 hidden h-fit rounded-xl border bg-card p-3 shadow-sm lg:block">
          <h2 className="mb-2 px-2 text-sm font-semibold">Sections</h2>
          <ul className="space-y-1">{handbook.entries.map((item) => <li key={item.id}>
            <Link href={`/handbook/${item.id}`} aria-current={item.id === entry.id ? "page" : undefined} className="flex min-h-10 items-start gap-2 rounded-md px-2 py-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:font-medium aria-[current=page]:text-primary"><ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{item.title}</Link>
          </li>)}</ul>
        </nav>
        <article className="relative min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
          <div className="p-5 pl-6 sm:p-7 sm:pl-8 lg:p-8 lg:pl-9">
            <p className="text-sm font-medium text-muted-foreground">{handbook.center.name}</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{entry.title}</h1>
            <p className="mt-4 max-w-3xl text-sm font-medium leading-6 sm:text-base sm:leading-7">{entry.shortAnswer}</p>
            <div className="mt-6 border-t pt-5 sm:mt-7 sm:pt-6"><p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 sm:text-base sm:leading-8">{entry.answer}</p></div>
            <div className="mt-7 flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-t pt-4 text-xs text-muted-foreground sm:mt-8">
              <div className="flex items-start gap-2"><BookOpen aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p><span className="font-medium text-foreground">Source:</span> {entry.sourceLabel}</p></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1"><span>{entry.category}</span><span>Reviewed {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(entry.reviewedAt))}</span></div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </main>;
}
