import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { getPublicHandbook } from "@/lib/public-handbook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Family handbook | brightflare",
  description: "Published answers and policies from Little Lantern Learning Center.",
};

export default async function HandbookPage() {
  const handbook = await getPublicHandbook();
  const handbookLabel = handbook?.center.handbookLabel || "Family handbook";

  return <main className="min-h-screen bg-muted/30 text-foreground">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Brightflare family desk"><Logo size={32} /></Link>
        <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Family desk</Link>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5 border-b pb-5 sm:mb-7 sm:pb-6">
        <p className="text-sm font-medium text-muted-foreground">{handbook?.center.name ?? "Little Lantern Learning Center"}</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{handbookLabel}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">Center-approved information families can return to anytime.</p>
      </div>
      {!handbook ? <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">The handbook is temporarily unavailable. Please ask the front desk team.</p> :
        <div className="grid items-start gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-7">
          <details className="group rounded-xl border bg-card p-3 shadow-sm lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
              <span>Browse sections</span><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <ul aria-label="Handbook sections" className="mt-3 grid gap-1 border-t pt-3">
              {handbook.entries.map((entry) => <li key={entry.id}>
                <Link href={`/handbook/${entry.id}`} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-primary" />{entry.title}</Link>
              </li>)}
            </ul>
          </details>
          <nav aria-label="Handbook sections" className="sticky top-5 hidden h-fit rounded-xl border bg-card p-3 shadow-sm lg:block">
            <h2 className="mb-2 px-2 text-sm font-semibold">Sections</h2>
            <ul className="space-y-1">{handbook.entries.map((entry) => <li key={entry.id}>
              <Link href={`/handbook/${entry.id}`} className="flex min-h-10 items-start gap-2 rounded-md px-2 py-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{entry.title}</Link>
            </li>)}</ul>
          </nav>
          <section aria-label="Published handbook answers" className="min-w-0 space-y-3 sm:space-y-4">
            {handbook.entries.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No published sections are available right now.</p> : null}
            {handbook.entries.map((entry) => <article key={entry.id} className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
              <div className="p-4 pl-5 sm:p-5 sm:pl-6">
                <h2 className="text-base font-semibold leading-snug tracking-tight sm:text-lg"><Link href={`/handbook/${entry.id}`} className="rounded-sm decoration-primary underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{entry.title}</Link></h2>
                <p className="mt-2 text-sm leading-6 sm:text-[0.9375rem] sm:leading-7">{entry.shortAnswer}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">{entry.category}<span aria-hidden="true"> · </span>{entry.sourceLabel}</p>
                  <Link href={`/handbook/${entry.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpen aria-hidden="true" className="size-4" />Read section</Link>
                </div>
              </div>
            </article>)}
          </section>
        </div>}
    </div>
  </main>;
}
