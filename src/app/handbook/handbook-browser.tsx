"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/brand/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type HandbookEntry = {
  id: string;
  title: string;
  shortAnswer: string;
  answer: string;
  sourceLabel: string;
  category: string;
  tags: string[];
  reviewedAt: number;
};

type HandbookBrowserProps = {
  centerName: string;
  centerHours?: string;
  handbookLabel: string;
  entries: HandbookEntry[];
  selectedEntryId?: string;
  isUnavailable?: boolean;
};

function formatReviewDate(value: number) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export function HandbookBrowser({ centerName, centerHours, handbookLabel, entries, selectedEntryId, isUnavailable = false }: HandbookBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const filteredEntries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => [
      entry.title,
      entry.shortAnswer,
      entry.answer,
      entry.sourceLabel,
      entry.category,
      ...entry.tags,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  }, [entries, searchQuery]);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, HandbookEntry[]>();
    for (const entry of filteredEntries) {
      const category = entry.category || "Other answers";
      const categoryEntries = groups.get(category) ?? [];
      categoryEntries.push(entry);
      groups.set(category, categoryEntries);
    }
    return Array.from(groups, ([category, categoryEntries]) => ({ category, entries: categoryEntries }));
  }, [filteredEntries]);

  return (
    <AppShell section="handbook" centerName={isUnavailable ? undefined : centerName} centerHours={isUnavailable ? undefined : centerHours}>
      <main className="handbook-browser text-foreground">
        <header className="mb-5 border-b border-border pb-5 sm:mb-7 sm:pb-6">
          <h1 className="type-page-title">{handbookLabel}</h1>
          <p className="type-supporting mt-2 max-w-2xl">Center-approved answers you can return to anytime.</p>
        </header>

        {isUnavailable ? <p role="status" className="type-supporting rounded-xl border border-border bg-card p-5 shadow-hard-sm">The handbook is temporarily unavailable. Please ask the front desk team.</p> :
          <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
            <aside className="min-w-0">
              <Button type="button" variant="disclosure" className="mb-3 flex w-full justify-between lg:hidden" aria-expanded={isMobileNavigationOpen} onClick={() => setIsMobileNavigationOpen((isOpen) => !isOpen)}>
                Browse answers<ChevronRight aria-hidden="true" className={`size-5 transition-transform ${isMobileNavigationOpen ? "rotate-90" : ""}`} />
              </Button>
              <nav aria-label="Handbook answers" className={`rounded-xl border border-border bg-card p-3 shadow-hard-sm ${isMobileNavigationOpen ? "block" : "hidden lg:block"}`}>
                <label className="relative block">
                  <Search aria-hidden="true" className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" aria-label="Search handbook" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search handbook" className="pl-10" />
                </label>
                <h2 className="type-panel-title mb-2 mt-4 px-1">Browse answers</h2>
                {categoryGroups.length === 0 ? <p role="status" className="type-supporting px-1 py-3">No answers match your search.</p> : categoryGroups.map(({ category, entries: groupedEntries }) => <div key={category} className="border-t border-border py-2">
                  <h3 className="type-subheading mb-1 px-1">{category}</h3>
                  <ul className="space-y-1">{groupedEntries.map((entry) => {
                    const isSelected = entry.id === selectedEntry?.id;
                    return <li key={entry.id}>
                      <Link
                        href={`/handbook/${encodeURIComponent(entry.id)}`}
                        aria-current={isSelected ? "page" : undefined}
                        className={`block w-full rounded-md px-3 py-2 text-sm leading-5 font-normal text-foreground underline-offset-4 hover:text-[#3555b0] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isSelected ? "font-semibold text-[#3555b0] underline decoration-2" : ""}`}
                      >
                        {entry.title}
                      </Link>
                    </li>;
                  })}</ul>
                </div>)}
              </nav>
            </aside>

            <section aria-label="Published handbook answer" className="min-w-0">
              {!selectedEntry ? <p role="status" className="type-supporting rounded-xl border border-border bg-card p-5 shadow-hard-sm">No published handbook sections are available right now.</p> :
                <article className="overflow-hidden rounded-[14px] border border-border bg-card shadow-hard-lg">
                  <div className="p-5 sm:p-7 lg:p-8">
                    <h2 className="type-section-title">{selectedEntry.title}</h2>
                    <p className="type-supporting-strong mt-3 max-w-3xl">{selectedEntry.shortAnswer}</p>
                    <p className="type-body mt-5 max-w-3xl whitespace-pre-wrap" style={{ lineHeight: "26px" }}>{selectedEntry.answer}</p>
                    <div className="mt-6 flex flex-wrap items-start justify-between gap-x-5 gap-y-3 border-t border-border pt-4">
                      <div className="flex items-start gap-2"><BookOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-teal" /><p className="type-metadata"><span className="type-supporting-strong">Source:</span> {selectedEntry.sourceLabel}</p></div>
                      <div className="type-metadata flex flex-wrap gap-x-4 gap-y-1"><span>{selectedEntry.category}</span><span>Reviewed {formatReviewDate(selectedEntry.reviewedAt)}</span></div>
                    </div>
                    <div className="mt-6 border-t border-border pt-4">
                      <h3 className="type-panel-title">Still need help?</h3>
                      <p className="type-supporting mt-1 max-w-3xl">For questions specific to your family, speak with a member of the {centerName} team.</p>
                      <Button asChild variant="secondary" size="sm" className="mt-3">
                        <Link href="/">Ask another question<ArrowUpRight data-icon="inline-end" aria-hidden="true" /></Link>
                      </Button>
                    </div>
                  </div>
                </article>}
            </section>
          </div>}
      </main>
    </AppShell>
  );
}
