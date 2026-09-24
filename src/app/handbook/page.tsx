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

  return <main className="min-h-screen bg-muted/40 text-foreground">
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Brightflare family desk"><Logo size={32} /></Link>
        <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">Family desk</Link>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 rounded-xl border bg-card px-5 py-6 shadow-sm sm:mb-8 sm:px-8 sm:py-8">
        <p className="text-sm font-medium text-primary">{handbook?.center.name ?? "Little Lantern Learning Center"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-4xl">{handbookLabel}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">Center-approved information families can return to anytime.</p>
      </div>
      {!handbook ? <p role="status" className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">The handbook is temporarily unavailable. Please ask the front desk team.</p> :
        <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
          <details className="group rounded-xl border bg-card p-4 shadow-sm lg:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
              <span>Browse sections</span><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <ul aria-label="Handbook sections" className="mt-3 grid gap-1 border-t pt-3">
              {handbook.entries.map((entry) => <li key={entry.id}>
                <Link href={`/handbook/${entry.id}`} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight aria-hidden="true" className="size-4 shrink-0 text-primary" />{entry.title}</Link>
              </li>)}
            </ul>
          </details>
          <nav aria-label="Handbook sections" className="sticky top-5 hidden h-fit rounded-xl border bg-card p-4 shadow-sm lg:block">
            <h2 className="mb-3 px-2 text-sm font-semibold">On this page</h2>
            <ul className="space-y-1">{handbook.entries.map((entry) => <li key={entry.id}>
              <Link href={`/handbook/${entry.id}`} className="flex min-h-10 items-start gap-2 rounded-md px-2 py-2 text-sm leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />{entry.title}</Link>
            </li>)}</ul>
          </nav>
          <section aria-label="Published handbook answers" className="min-w-0 space-y-4 sm:space-y-5">
            {handbook.entries.length === 0 ? <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">No published sections are available right now.</p> : null}
            {handbook.entries.map((entry) => <article key={entry.id} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{entry.category}</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-2xl"><Link href={`/handbook/${entry.id}`} className="rounded-sm decoration-primary underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{entry.title}</Link></h2>
              <p className="mt-3 text-sm leading-6 sm:text-base sm:leading-7">{entry.shortAnswer}</p>
              <Link href={`/handbook/${entry.id}`} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpen aria-hidden="true" className="size-4" />Read the section</Link>
            </article>)}
          </section>
        </div>}
    </div>
  </main>;
}
