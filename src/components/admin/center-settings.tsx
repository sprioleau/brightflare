"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/brand/app-shell";
import { AppToast } from "@/components/ui/app-toast";
import { AdminWorkspaceNav } from "@/components/admin/admin-workspace-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  name: string;
  hours: string;
  tagline: string;
  timezone: string;
  handbookLabel: string;
  websiteUrl: string;
  tone: string;
  audience: string;
  preferredTerms: string[];
  forbiddenTerms: string[];
  glossary: { term: string; definition: string }[];
};

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <p className="type-supporting text-muted-foreground">{hint}</p> : null}
    </div>
  );
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

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 5000);

    return () => window.clearTimeout(timeout);
  }, [message]);

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
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Settings could not be saved.");
      setMessage("Settings saved. Updated center details are live for families.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell section="admin" centerName={settings?.name}>
      <main className="admin-workspace space-y-6 [&_svg]:size-5 [&_svg]:stroke-[1.75]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
          <div>
            <h1 className="type-page-title">Center settings</h1>
            <p className="type-supporting mt-1 max-w-2xl">Keep the details and writing guidance behind family answers current.</p>
          </div>
        </div>
        <div className="grid items-start gap-6 min-[971px]:grid-cols-[220px_minmax(0,1fr)]">
          <AdminWorkspaceNav activeView="settings" />
          <div className="min-w-0 space-y-5">
        {error ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 type-supporting text-destructive">{error}{!settings ? <> <a href="/admin" className="font-semibold underline">Go to sign in</a></> : null}</p> : null}
        {!settings && !error ? <p role="status" className="type-supporting">Loading center settings…</p> : null}
        {settings ? (
          <form onSubmit={save} className="flex max-w-[1120px] flex-col gap-5">
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="type-panel-title">Center information</CardTitle>
                <CardDescription>Families see these details at the front desk and in the handbook.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><TextField label="Center name" value={settings.name} onChange={(value) => update("name", value)} /></div>
                <div className="sm:col-span-2"><TextField label="Hours" value={settings.hours} onChange={(value) => update("hours", value)} hint="Include days and opening times. Confirm holiday exceptions in the handbook." /></div>
                <div className="sm:col-span-2"><TextField label="Tagline" value={settings.tagline} onChange={(value) => update("tagline", value)} /></div>
                <TextField label="Time zone" value={settings.timezone} onChange={(value) => update("timezone", value)} />
                <TextField label="Handbook title" value={settings.handbookLabel} onChange={(value) => update("handbookLabel", value)} />
                <div className="sm:col-span-2"><TextField label="Center website" value={settings.websiteUrl} onChange={(value) => update("websiteUrl", value)} hint="Optional external reference. Published handbook answers remain available in Brightflare." /></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="border-b pb-4">
                <CardTitle className="type-panel-title">Agent writing guidance</CardTitle>
                <CardDescription>Brightflare uses this guidance when drafting answers and recommendations. Staff review changes before publication.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 pt-5">
                <TextField label="Tone of voice" value={settings.tone} onChange={(value) => update("tone", value)} />
                <TextField label="Audience" value={settings.audience} onChange={(value) => update("audience", value)} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2"><Label htmlFor="preferred-terms">Preferred terms</Label><Textarea id="preferred-terms" rows={4} value={settings.preferredTerms.join("\n")} onChange={(event) => update("preferredTerms", splitLines(event.target.value))} /><p className="type-supporting text-muted-foreground">One term per line.</p></div>
                  <div className="flex flex-col gap-2"><Label htmlFor="forbidden-terms">Terms to avoid</Label><Textarea id="forbidden-terms" rows={4} value={settings.forbiddenTerms.join("\n")} onChange={(event) => update("forbiddenTerms", splitLines(event.target.value))} /><p className="type-supporting text-muted-foreground">One term per line.</p></div>
                </div>
                <div className="flex flex-col gap-2"><Label htmlFor="center-glossary">Center glossary</Label><Textarea id="center-glossary" rows={4} value={settings.glossary.map(({ term, definition }) => `${term}: ${definition}`).join("\n")} onChange={(event) => update("glossary", splitLines(event.target.value).map((line) => { const [term, ...definition] = line.split(":"); return { term: term.trim(), definition: definition.join(":").trim() }; }).filter(({ term, definition }) => term && definition))} /><p className="type-supporting text-muted-foreground">One entry per line: term: meaning.</p></div>
              </CardContent>
            </Card>
            <div className="flex items-center gap-4"><Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save settings"}</Button></div>
          </form>
        ) : null}
          </div>
        </div>
        {message ? <AppToast message={message} onDismiss={() => setMessage("")} /> : null}
      </main>
    </AppShell>
  );
}
