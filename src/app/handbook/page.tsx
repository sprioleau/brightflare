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
  return <main className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
      <Link href="/" aria-label="Brightflare family desk"><Logo size={32} /></Link>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">Family desk</Link>
    </div></header>
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-10 max-w-2xl">
        <p className="text-sm text-muted-foreground">{handbook?.center.name ?? "Little Lantern Learning Center"}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Family handbook</h1>
        <p className="mt-3 text-base text-muted-foreground">Center-approved information families can return to anytime.</p>
      </div>
      {!handbook ? <p role="status">The handbook is temporarily unavailable. Please ask the front desk team.</p> :
        <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Handbook sections" className="h-fit rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-semibold">Sections</h2>
            <ul className="space-y-1">{handbook.entries.map((entry) => <li key={entry.id}>
              <Link href={`/handbook/${entry.id}`} className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{entry.title}</Link>
            </li>)}</ul>
          </nav>
          <section aria-label="Published handbook answers" className="space-y-4">
            {handbook.entries.length === 0 ? <p>No published sections are available right now.</p> : null}
            {handbook.entries.map((entry) => <article key={entry.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{entry.category}</p>
              <h2 className="mt-1 text-xl font-semibold"><Link href={`/handbook/${entry.id}`} className="hover:text-primary hover:underline">{entry.title}</Link></h2>
              <p className="mt-3 leading-7">{entry.shortAnswer}</p>
              <Link href={`/handbook/${entry.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><BookOpen aria-hidden="true" className="size-4" />Read the section</Link>
            </article>)}
          </section>
        </div>}
    </div>
  </main>;
}
