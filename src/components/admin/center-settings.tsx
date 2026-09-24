"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, LayoutDashboard, Settings2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  name: string; hours: string; tagline: string; timezone: string; handbookLabel: string; websiteUrl: string;
  tone: string; audience: string; preferredTerms: string[]; forbiddenTerms: string[];
  glossary: { term: string; definition: string }[];
};

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return <div className="flex flex-col gap-2"><Label htmlFor={id}>{label}</Label><Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />{hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}</div>;
}

export default function CenterSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;
    fetch("/api/admin/settings", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!isActive) return;
      if (!response.ok) setError(response.status === 401 ? "Please sign in to manage center settings." : result.error);
      else setSettings(result as Settings);
    }).catch(() => { if (isActive) setError("Center settings are unavailable right now."); });
    return () => { isActive = false; };
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
    setMessage("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Settings could not be saved.");
      setMessage("Settings saved. Updated center details are live for families.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="min-h-screen bg-muted/30 text-foreground"><div className="mx-auto grid min-h-screen max-w-6xl md:grid-cols-[14rem_minmax(0,1fr)]">
    <aside className="flex flex-col border-b bg-card p-5 md:min-h-screen md:border-r md:border-b-0">
      <Link href="/admin" aria-label="Brightflare admin home"><Logo size={32} /></Link>
      <p className="mt-2 text-sm text-muted-foreground">{settings?.name ?? "Center workspace"}</p>
      <nav aria-label="Admin navigation" className="mt-8 flex flex-col gap-1">
        <Link href="/admin" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"><LayoutDashboard aria-hidden="true" className="size-4" />Overview</Link>
        <Link href="/handbook" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"><BookOpen aria-hidden="true" className="size-4" />Family handbook</Link>
      </nav>
      <Link href="/admin/settings" aria-current="page" className="mt-6 flex items-center gap-3 rounded-md bg-muted px-3 py-2 text-sm font-semibold text-primary md:mt-auto"><Settings2 aria-hidden="true" className="size-4" />Settings</Link>
    </aside>
    <main className="min-w-0 px-5 py-8 md:px-8">
      <div className="mb-8"><p className="text-sm text-muted-foreground">Center workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-muted-foreground">Keep center details and Brightflare’s writing guidance current.</p></div>
      {error ? <p role="alert" className="mb-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}{!settings ? <> <Link href="/admin" className="font-semibold underline">Go to sign in</Link></> : null}</p> : null}
      {!settings && !error ? <p role="status">Loading center settings…</p> : null}
      {settings ? <form onSubmit={save} className="flex max-w-3xl flex-col gap-6">
        <Card><CardHeader><CardTitle>Center information</CardTitle><CardDescription>Families see these details at the front desk and in the handbook.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextField label="Center name" value={settings.name} onChange={(value) => update("name", value)} /></div>
          <div className="sm:col-span-2"><TextField label="Hours" value={settings.hours} onChange={(value) => update("hours", value)} hint="Include days and opening times. Confirm holiday exceptions in the handbook." /></div>
          <div className="sm:col-span-2"><TextField label="Tagline" value={settings.tagline} onChange={(value) => update("tagline", value)} /></div>
          <TextField label="Time zone" value={settings.timezone} onChange={(value) => update("timezone", value)} />
          <TextField label="Handbook title" value={settings.handbookLabel} onChange={(value) => update("handbookLabel", value)} />
          <div className="sm:col-span-2"><TextField label="Center website" value={settings.websiteUrl} onChange={(value) => update("websiteUrl", value)} hint="Optional external reference. Published handbook answers remain available in Brightflare." /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Agent writing guidance</CardTitle><CardDescription>Brightflare uses this guidance when drafting answers and recommended handbook updates. Staff review changes before publication.</CardDescription></CardHeader><CardContent className="grid gap-5">
          <TextField label="Tone of voice" value={settings.tone} onChange={(value) => update("tone", value)} />
          <TextField label="Audience" value={settings.audience} onChange={(value) => update("audience", value)} />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2"><Label htmlFor="preferred-terms">Preferred terms</Label><Textarea id="preferred-terms" rows={4} value={settings.preferredTerms.join("\n")} onChange={(event) => update("preferredTerms", splitLines(event.target.value))} /><p className="text-sm text-muted-foreground">One term per line.</p></div>
            <div className="flex flex-col gap-2"><Label htmlFor="forbidden-terms">Terms to avoid</Label><Textarea id="forbidden-terms" rows={4} value={settings.forbiddenTerms.join("\n")} onChange={(event) => update("forbiddenTerms", splitLines(event.target.value))} /><p className="text-sm text-muted-foreground">One term per line.</p></div>
          </div>
          <div className="flex flex-col gap-2"><Label htmlFor="center-glossary">Center glossary</Label><Textarea id="center-glossary" rows={4} value={settings.glossary.map(({ term, definition }) => `${term}: ${definition}`).join("\n")} onChange={(event) => update("glossary", splitLines(event.target.value).map((line) => { const [term, ...definition] = line.split(":"); return { term: term.trim(), definition: definition.join(":").trim() }; }).filter(({ term, definition }) => term && definition))} /><p className="text-sm text-muted-foreground">One entry per line: term: meaning.</p></div>
        </CardContent></Card>
        <div className="flex items-center gap-4"><Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save settings"}</Button>{message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}</div>
      </form> : null}
    </main>
  </div></div>;
}
