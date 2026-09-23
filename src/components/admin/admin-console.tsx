"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Logo } from "@/components/brand/Logo"
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  WandSparkles,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type TopicStatus = "needs_answer" | "needs_review" | "answered" | "handled_by_staff" | string

type Topic = {
  id: string
  title: string
  questionCount: number
  sessionCount: number
  status: TopicStatus
  lastAskedAt: string
  examples: string[]
}

type KnowledgeEntry = {
  id: string
  title: string
  shortAnswer: string
  answer: string
  sourceLabel: string
  category: string
  isFeatured: boolean
  startsAt?: string
  endsAt?: string
}

type Suggestion = {
  id: string
  title: string
  reason: string
  questionCount: number
}

type QuestionEvent = {
  id: string
  question: string
  topicId: string | null
  topicTitle: string | null
  askedAt: string
  outcome: "answered" | "needs_staff"
  sourceStatus: "sourced" | "unsourced"
  isPrivate?: boolean
}

type AdminData = {
  center: { name: string }
  topics: Topic[]
  questions: QuestionEvent[]
  questionCursor: string | null
  knowledge: KnowledgeEntry[]
  suggestions: Suggestion[]
}

type KnowledgeDraft = {
  id?: string
  topicId?: string
  title: string
  shortAnswer: string
  answer: string
  sourceLabel: string
  category: string
  isFeatured: boolean
  startsAt: string
  endsAt: string
}

const emptyDraft: KnowledgeDraft = {
  title: "",
  shortAnswer: "",
  answer: "",
  sourceLabel: "",
  category: "General",
  isFeatured: false,
  startsAt: "",
  endsAt: "",
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

function formatQuestionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)
}

function statusLabel(status: TopicStatus) {
  if (status === "needs_answer") return "Needs answer"
  if (status === "needs_review") return "Needs review"
  if (status === "answered") return "Answered"
  if (status === "handled_by_staff") return "Handled by staff"
  return status.replaceAll("_", " ")
}

function statusVariant(status: TopicStatus): "default" | "secondary" | "outline" {
  if (status === "needs_answer") return "default"
  if (status === "needs_review") return "secondary"
  return "outline"
}

function toDateInput(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export default function AdminConsole() {
  const [data, setData] = useState<AdminData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<"stream" | "inbox" | "handbook">("stream")
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<KnowledgeDraft>(emptyDraft)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [assistMode, setAssistMode] = useState<"title" | "seasonal" | "knowledge" | null>(null)
  const [assistSuggestions, setAssistSuggestions] = useState<string[]>([])
  const [assistResultMode, setAssistResultMode] = useState<"title" | "seasonal" | "knowledge" | null>(null)
  const [assistError, setAssistError] = useState("")
  const [toast, setToast] = useState("")
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pin, setPin] = useState("")
  const [authError, setAuthError] = useState("")
  const [isLoadingOlderQuestions, setIsLoadingOlderQuestions] = useState(false)
  const [olderQuestionsError, setOlderQuestionsError] = useState("")

  const loadData = useCallback(async function loadData(shouldShowLoading = true) {
    if (shouldShowLoading) setIsLoading(true)
    setLoadError("")
    try {
      const response = await fetch("/api/admin", { cache: "no-store" })
      if (!response.ok) throw new Error(`Admin data could not be loaded (${response.status}).`)
      const result = (await response.json()) as AdminData
      setData((current) => {
        if (!current || current.questions.length <= 50) return result
        const freshIds = new Set(result.questions.map((event) => event.id))
        return {
          ...result,
          questions: [...result.questions, ...current.questions.filter((event) => !freshIds.has(event.id))],
          questionCursor: current.questionCursor,
        }
      })
      if (!selectedTopicId && result.topics.length) setSelectedTopicId(result.topics[0].id)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Admin data could not be loaded.")
    } finally {
      if (shouldShowLoading) setIsLoading(false)
    }
  }, [selectedTopicId])

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" })
        if (!response.ok) throw new Error("Could not verify your staff session.")
        const result = (await response.json()) as { role: "family" | "admin" | null }
        setIsAuthenticated(result.role === "admin")
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Could not verify your staff session.")
      } finally {
        setIsCheckingAuth(false)
      }
    }
    void checkAuth()
  }, [])

  useEffect(() => {
    if (isAuthenticated) void loadData()
  }, [isAuthenticated, loadData])

  useEffect(() => {
    if (!isAuthenticated) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadData(false)
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [isAuthenticated, loadData])

  const visibleTopics = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.topics ?? []).filter((topic) => !query || topic.title.toLowerCase().includes(query) || topic.examples.some((example) => example.toLowerCase().includes(query)))
  }, [data?.topics, search])

  const selectedTopic = visibleTopics.find((topic) => topic.id === selectedTopicId) ?? visibleTopics[0]
  const unansweredCount = (data?.topics ?? []).filter((topic) => topic.status === "needs_answer").length
  const questionTotal = (data?.topics ?? []).reduce((sum, topic) => sum + topic.questionCount, 0)
  const seasonalIdeas = useMemo(() => {
    const generated = assistResultMode === "seasonal"
      ? assistSuggestions.map((title, index) => ({ id: `assistant-${index}`, title, reason: "Suggested from seasonal patterns and past family questions.", questionCount: 0 }))
      : []
    return [...generated, ...(data?.suggestions ?? [])]
  }, [assistResultMode, assistSuggestions, data?.suggestions])

  async function loadOlderQuestions() {
    if (!data?.questionCursor || isLoadingOlderQuestions) return
    setIsLoadingOlderQuestions(true)
    setOlderQuestionsError("")
    try {
      const response = await fetch(`/api/admin?questionCursor=${encodeURIComponent(data.questionCursor)}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Earlier questions could not be loaded.")
      const result = (await response.json()) as Pick<AdminData, "questions" | "questionCursor">
      setData((current) => {
        if (!current) return current
        const existingIds = new Set(current.questions.map((event) => event.id))
        return { ...current, questions: [...current.questions, ...result.questions.filter((event) => !existingIds.has(event.id))], questionCursor: result.questionCursor }
      })
    } catch (error) {
      setOlderQuestionsError(error instanceof Error ? error.message : "Earlier questions could not be loaded.")
    } finally {
      setIsLoadingOlderQuestions(false)
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError("")
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin", pin }),
      })
      if (!response.ok) throw new Error(response.status === 401 ? "That PIN wasn’t recognized. Try again." : "Could not sign in. Please try again.")
      const result = (await response.json()) as { role?: "family" | "admin" | null }
      if (result.role !== "admin") throw new Error("This PIN does not have staff access.")
      setPin("")
      setIsAuthenticated(true)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in. Please try again.")
    }
  }

  function openNewEntry(prefill?: Partial<KnowledgeDraft>) {
    setDraft({ ...emptyDraft, ...prefill })
    setSaveError("")
    setAssistSuggestions([])
    setIsEditing(true)
  }

  function openEntry(entry: KnowledgeEntry) {
    setDraft({
      id: entry.id,
      title: entry.title,
      shortAnswer: entry.shortAnswer,
      answer: entry.answer,
      sourceLabel: entry.sourceLabel,
      category: entry.category,
      isFeatured: entry.isFeatured,
      startsAt: toDateInput(entry.startsAt),
      endsAt: toDateInput(entry.endsAt),
    })
    setSaveError("")
    setIsEditing(true)
  }

  async function saveKnowledge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setSaveError("")
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          startsAt: draft.startsAt || undefined,
          endsAt: draft.endsAt || undefined,
          topicId: draft.topicId,
        }),
      })
      if (!response.ok) throw new Error(`The handbook update was not saved (${response.status}).`)
      setToast("Handbook answer saved and ready for parents.")
      setIsEditing(false)
      setDraft(emptyDraft)
      await loadData()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The handbook update was not saved.")
    } finally {
      setIsSaving(false)
    }
  }

  async function askAssistant(mode: "title" | "seasonal" | "knowledge", topic?: Topic) {
    setAssistMode(mode)
    setAssistResultMode(null)
    setAssistError("")
    setAssistSuggestions([])
    const modeText = mode === "title" ? draft.title : mode === "knowledge" ? topic?.title ?? draft.title : undefined
    try {
      const response = await fetch("/api/admin/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, topicId: topic?.id, text: modeText }),
      })
      if (!response.ok) throw new Error(`The assistant could not complete this request (${response.status}).`)
      const result = (await response.json()) as { suggestions?: Array<string | { title?: string; answer?: string }> }
      const suggestions = (result.suggestions ?? []).map((item) => typeof item === "string" ? item : item.title ?? item.answer ?? "").filter(Boolean)
      setAssistSuggestions(suggestions)
      if (!suggestions.length) setAssistError("No suggestions came back. Try again or write the answer yourself.")
    } catch (error) {
      setAssistError(error instanceof Error ? error.message : "The assistant could not complete this request.")
    } finally {
      setAssistMode(null)
      setAssistResultMode(mode)
    }
  }

  function applySuggestion(suggestion: string) {
    if (assistSuggestions.includes(suggestion)) {
      setDraft((current) => ({ ...current, title: suggestion }))
    }
  }

  if (isCheckingAuth) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Checking staff access…</div></div>
  }

  if (!isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><Card className="w-full max-w-md shadow-hard-lg"><CardHeader><div className="mb-4"><Logo size={36} /></div><CardTitle className="text-2xl font-bold">Staff access</CardTitle><CardDescription>Enter your center PIN to manage brightflare answers and family questions.</CardDescription></CardHeader><CardContent><form onSubmit={signIn} className="flex flex-col gap-4">{authError && <p className="text-sm text-destructive" role="alert">{authError}</p>}<label className="flex flex-col gap-2 text-sm font-medium" htmlFor="admin-pin">Center PIN<Input id="admin-pin" autoComplete="current-password" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} required /></label><Button className="w-full" disabled={!pin.trim()}>Continue</Button></form></CardContent></Card></div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b-2 border-foreground bg-card">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Logo size={32} variant="mark" />
            <div className="leading-tight">
              <div className="font-bold tracking-tight">brightflare <span className="font-medium text-muted-foreground">Admin</span></div>
              <div className="mt-0.5 text-xs text-muted-foreground">{data?.center.name ?? "Center knowledge"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border-2 border-foreground bg-brand-teal px-3 py-1.5 text-xs font-semibold text-foreground">
            <span className="size-2 rounded-full bg-foreground" /> Center staff workspace
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 lg:py-10">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 inline-flex rounded-md border-2 border-foreground bg-brand-amber px-2.5 py-1 text-xs font-bold">CENTER OVERVIEW</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Good morning, team</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">See what families are asking, keep your handbook up to date, and get the right answer to the front desk.</p>
          </div>
          <Button onClick={() => openNewEntry()} className="gap-2"><Plus className="h-4 w-4" /> Add an answer</Button>
        </div>

        {toast && <Alert className="mb-5"><Check className="size-4" /><AlertTitle>Published</AlertTitle><AlertDescription>{toast}</AlertDescription></Alert>}
        {loadError && <Alert variant="destructive" className="mb-5"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t load your center data</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{loadError}<Button variant="outline" size="sm" onClick={() => void loadData()}>Try again</Button></AlertDescription></Alert>}

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <MetricCard icon={<MessageCircle />} label="Family questions" value={isLoading ? "—" : String(questionTotal)} footnote="Across tracked topics" />
          <MetricCard icon={<CircleHelp />} label="Need your answer" value={isLoading ? "—" : String(unansweredCount)} footnote="Topics without an approved answer" />
          <MetricCard icon={<BookOpen />} label="In the handbook" value={isLoading ? "—" : String(data?.knowledge.length ?? 0)} footnote="Published center answers" />
        </section>

        <div className="mb-4 flex items-center gap-1 border-b">
          <button onClick={() => { setActiveView("stream"); setIsEditing(false) }} className={`relative px-4 py-3 text-sm font-medium transition-colors ${activeView === "stream" ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
            Recent questions
          </button>
          <button onClick={() => { setActiveView("inbox"); setIsEditing(false) }} className={`relative px-4 py-3 text-sm font-medium transition-colors ${activeView === "inbox" ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
            Topics <Badge variant="secondary" className="ml-1.5">{unansweredCount}</Badge>
          </button>
          <button onClick={() => { setActiveView("handbook"); setIsEditing(false) }} className={`relative px-4 py-3 text-sm font-medium transition-colors ${activeView === "handbook" ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>
            Handbook & FAQs <span className="ml-1.5 text-xs text-muted-foreground">{data?.knowledge.length ?? ""}</span>
          </button>
        </div>

        {isLoading && !data ? <Card className="flex min-h-72 items-center justify-center"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading your center…</div></Card> : activeView === "stream" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0 shadow-hard">
              <CardHeader className="border-b-2 pb-4">
                <CardTitle className="text-xl font-bold">Every question, as it comes in</CardTitle>
                <CardDescription className="text-sm">Recent parent questions update every 15 seconds. Private child questions appear without names or message details.</CardDescription>
              </CardHeader>
              <div className="divide-y-2 divide-border">
                {(data?.questions ?? []).length ? data?.questions.map((event) => (
                  <div key={event.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={event.outcome === "answered" ? "bg-brand-teal text-foreground" : "bg-brand-amber text-foreground"}>{event.outcome === "answered" ? "Answered" : "Needs staff"}</Badge>
                        <span className="text-xs text-muted-foreground">{formatQuestionTime(event.askedAt)}</span>
                      </div>
                      <p className="text-base font-semibold leading-snug">{event.question}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{event.topicTitle ? `Topic: ${event.topicTitle}` : "Private family question"} · {event.sourceStatus === "sourced" ? "Sourced answer" : "No verified source"}</p>
                    </div>
                    {event.topicId ? <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => { setSelectedTopicId(event.topicId); setActiveView("inbox") }}>Review topic<ChevronRight data-icon="inline-end" /></Button> : null}
                  </div>
                )) : <div className="p-8 text-center text-sm text-muted-foreground">New parent questions will appear here as they are asked.</div>}
              </div>
              {data?.questionCursor ? <div className="flex flex-col items-center gap-2 border-t-2 px-5 py-4"><Button variant="outline" onClick={() => void loadOlderQuestions()} disabled={isLoadingOlderQuestions}>{isLoadingOlderQuestions ? "Loading earlier questions…" : "Load earlier questions"}</Button>{olderQuestionsError ? <p role="alert" className="text-sm text-destructive">{olderQuestionsError}</p> : null}</div> : null}
            </Card>
            <Card className="self-start bg-accent">
              <CardHeader><CardTitle className="text-lg font-bold">Turn demand into answers</CardTitle><CardDescription className="text-foreground">Questions with no verified source become topics for your team to review.</CardDescription></CardHeader>
              <CardContent className="space-y-3"><p className="text-sm">{unansweredCount} topics need an approved answer. Similar questions are grouped so one handbook update can help many families.</p><Button variant="outline" className="w-full bg-card" onClick={() => setActiveView("inbox")}>Review topics<ArrowUpRight data-icon="inline-end" /></Button></CardContent>
            </Card>
          </div>
        ) : activeView === "inbox" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.88fr)]">
            <Card className="min-w-0 shadow-hard">
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><CardTitle className="text-lg">Questions families are asking</CardTitle><CardDescription className="mt-1">Similar questions are grouped into topics. Counts use anonymous sessions.</CardDescription></div>
                  <Badge variant="secondary">{unansweredCount} need attention</Badge>
                </div>
                <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search question topics" placeholder="Search topics or parent wording" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
              </CardHeader>
              <div className="divide-y">
                {visibleTopics.length ? visibleTopics.map((topic) => (
                  <button key={topic.id} onClick={() => { setSelectedTopicId(topic.id); setAssistSuggestions([]); setAssistError("") }} className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${topic.id === selectedTopic?.id ? "bg-muted" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={statusVariant(topic.status)}>{statusLabel(topic.status)}</Badge><span className="text-xs text-muted-foreground">{formatRelativeTime(topic.lastAskedAt)}</span></div><p className="font-medium leading-snug">{topic.title}</p><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">“{topic.examples[0] ?? "Parent question"}”</p></div>
                      <div className="shrink-0 text-right"><div className="text-lg font-semibold tabular-nums">{topic.questionCount}</div><div className="text-xs text-muted-foreground">questions</div><div className="mt-1 text-xs text-muted-foreground">{topic.sessionCount} sessions</div></div>
                    </div>
                  </button>
                )) : <div className="p-10 text-center text-sm text-muted-foreground">No question topics match that search.</div>}
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="shadow-hard">
                {selectedTopic ? <>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between gap-3"><Badge variant={statusVariant(selectedTopic.status)}>{statusLabel(selectedTopic.status)}</Badge><span className="text-xs text-muted-foreground">Last asked {formatRelativeTime(selectedTopic.lastAskedAt).toLowerCase()}</span></div>
                    <CardTitle className="text-xl leading-snug">{selectedTopic.title}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 pt-1"><span>{selectedTopic.questionCount} questions</span><span>·</span><span>{selectedTopic.sessionCount} anonymous sessions</span></CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How families ask</h3><div className="flex flex-col gap-2">{selectedTopic.examples.slice(0, 3).map((example, index) => <p key={`${example}-${index}`} className="rounded-md border px-3 py-2 text-sm text-muted-foreground">“{example}”</p>)}</div><p className="mt-2 text-xs text-muted-foreground">Names and child details are removed from this view.</p></div>
                    <div className="rounded-md border p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><WandSparkles className="size-4 text-primary" /> Admin assistant</div><p className="text-sm text-muted-foreground">Use center history to draft a response or shape this into a short front desk FAQ. You approve every change.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button variant="outline" size="sm" className="justify-start gap-2" disabled={assistMode !== null} onClick={() => void askAssistant("knowledge", selectedTopic)}>{assistMode === "knowledge" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <WandSparkles data-icon="inline-start" />} Draft an answer</Button><Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}><Plus data-icon="inline-start" /> Add to handbook</Button></div></div>
                    {assistError && <p className="text-sm text-destructive" role="alert">{assistError}</p>}
                    {assistResultMode === "knowledge" && assistSuggestions.length > 0 && <div className="rounded-lg border bg-card p-3"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Assistant suggestions</span><Button size="sm" variant="ghost" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, answer: assistSuggestions[0], category: "Family questions" })}>Review & edit <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div><p className="line-clamp-4 text-sm text-muted-foreground">{assistSuggestions[0]}</p></div>}
                    {selectedTopic.status === "needs_answer" && <Button className="w-full gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}>Write an approved answer <ChevronRight className="h-4 w-4" /></Button>}
                  </CardContent>
                </> : <div className="p-12 text-center text-sm text-muted-foreground">No topics yet. Parent questions will appear here as they come in.</div>}
              </Card>
              <SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="shadow-hard">
              <CardHeader className="flex-row items-center justify-between gap-4 border-b pb-4"><div><CardTitle className="text-lg">Center handbook</CardTitle><CardDescription className="mt-1">Approved answers, sourced to your center’s policies and updates.</CardDescription></div><Button size="sm" onClick={() => openNewEntry()}><Plus className="mr-1 h-4 w-4" /> Add answer</Button></CardHeader>
              <div className="divide-y">{(data?.knowledge ?? []).map((entry) => <button key={entry.id} onClick={() => openEntry(entry)} className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-medium">{entry.title}</span>{entry.isFeatured && <Badge variant="secondary" className="text-[10px]">Front desk</Badge>}</div><p className="line-clamp-2 text-sm text-muted-foreground">{entry.shortAnswer}</p><span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />{entry.sourceLabel}</span></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></button>)}{!data?.knowledge.length && <div className="p-10 text-center text-sm text-muted-foreground">Your handbook is ready for its first approved answer.</div>}</div>
            </Card>
            <div className="space-y-5"><SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} /><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-primary" /> Keep answers current</CardTitle><CardDescription>Seasonal answers show only during the dates you choose.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Use effective dates for holidays, weather closures, and school calendar changes. The front desk can show the short answer while parents can open the full policy and source.</p></CardContent></Card></div>
          </div>
        )}
      </main>

      {isEditing && <div className="fixed inset-0 z-40 flex justify-end bg-foreground/20" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsEditing(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="editor-heading" className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-background">
          <div className="flex items-start justify-between border-b px-6 py-5"><div><p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">Center handbook</p><h2 id="editor-heading" className="text-xl font-semibold">{draft.id ? "Edit answer" : "Add an answer"}</h2><p className="mt-1 text-sm text-muted-foreground">Everything here is reviewed by your team before families see it.</p></div><Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Close</Button></div>
          <form onSubmit={saveKnowledge} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              {saveError && <Alert variant="destructive"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t save this answer</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert>}
              <Field label="FAQ title" hint="Keep it short so it fits on the front desk screen."><div className="flex gap-2"><Input aria-label="FAQ title" required maxLength={65} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Are we open on the teacher workday?" /><Button type="button" variant="outline" size="icon" aria-label="Suggest a shorter FAQ title" title="Suggest a shorter title" disabled={!draft.title || assistMode === "title"} onClick={() => void askAssistant("title")}><WandSparkles className="h-4 w-4" /></Button></div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{assistMode === "title" ? "Finding a shorter title…" : "Families see this question first."}</span><span>{draft.title.length}/65</span></div>{assistSuggestions.length > 0 && assistMode === null && <div className="mt-2 flex flex-wrap gap-2">{assistSuggestions.map((suggestion) => <Button key={suggestion} type="button" size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>{suggestion}</Button>)}</div>}</Field>
              <Field label="Short answer" hint="One sentence for the front desk card."><Textarea aria-label="Short answer" required rows={2} maxLength={180} value={draft.shortAnswer} onChange={(event) => setDraft((current) => ({ ...current, shortAnswer: event.target.value }))} placeholder="A clear, direct answer in plain language." /><div className="mt-1 text-right text-xs text-muted-foreground">{draft.shortAnswer.length}/180</div></Field>
              <Field label="Full answer"><Textarea aria-label="Full answer" required rows={5} value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Include the details families need and any next step." /></Field>
              <Field label="Source" hint="Name the handbook section, center update, or website page."><Input aria-label="Source" required value={draft.sourceLabel} onChange={(event) => setDraft((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="e.g. Family handbook · Hours & closures" /></Field>
              <Field label="Category"><Input aria-label="Category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="General, meals, schedule…" /></Field>
              <div className="rounded-lg border p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => setDraft((current) => ({ ...current, isFeatured: event.target.checked }))} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block text-sm font-medium">Show on front desk</span><span className="mt-0.5 block text-xs text-muted-foreground">Feature this answer as a visible FAQ card for parents.</span></span></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts on" hint="Optional"><Input type="date" value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} /></Field><Field label="Ends on" hint="Optional"><Input type="date" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></Field></div>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" /> Published answers become part of the center handbook that supports parent responses. Seasonal dates keep time-sensitive information current.</p>
            </div>
            <div className="flex items-center justify-between border-t bg-background px-6 py-4"><Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button><Button type="submit" disabled={isSaving || !draft.title.trim() || !draft.answer.trim() || !draft.sourceLabel.trim()} className="gap-2">{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isSaving ? "Saving…" : "Save to handbook"}</Button></div>
          </form>
        </section>
      </div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="block text-sm font-medium">{label}</label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
}

function MetricCard({ icon, label, value, footnote }: { icon: React.ReactNode; label: string; value: string; footnote: string }) {
  return <Card><CardContent className="flex items-start justify-between p-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{footnote}</p></div><span className="flex size-8 items-center justify-center rounded-md border text-primary">{icon}</span></CardContent></Card>
}

function SeasonalPanel({ suggestions, isLoading, error, onSuggest, onAdd }: { suggestions: Suggestion[]; isLoading: boolean; error: string; onSuggest: () => void; onAdd: (title: string) => void }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-primary" /> Coming up this season</CardTitle>
          <Button size="icon-sm" variant="ghost" aria-label="Refresh seasonal suggestions" onClick={onSuggest} disabled={isLoading}>{isLoading ? <LoaderCircle className="animate-spin" /> : <ArrowUpRight />}</Button>
        </div>
        <CardDescription>Ideas based on the time of year and past family questions.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {suggestions.slice(0, 3).map((suggestion) => <div key={suggestion.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium leading-snug">{suggestion.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{suggestion.reason}{suggestion.questionCount > 0 && ` · ${suggestion.questionCount} past questions`}</p></div><Button size="sm" variant="outline" className="shrink-0" onClick={() => onAdd(suggestion.title)}>Review</Button></div>)}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {suggestions.length === 0 && !isLoading && <p className="py-1 text-sm text-muted-foreground">Ask the assistant to look at historical questions for timely topics.</p>}
        <Button variant="secondary" size="sm" onClick={onSuggest} disabled={isLoading} className="mt-1 w-full gap-2">{isLoading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Clock3 data-icon="inline-start" />}{isLoading ? "Looking through past questions…" : "Find seasonal ideas"}</Button>
      </CardContent>
    </Card>
  )
}
