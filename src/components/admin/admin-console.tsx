"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Logo } from "@/components/brand/Logo"
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  Check,
  X,
  GripVertical,
  LayoutDashboard,
  ClipboardCheck,
  Megaphone,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Settings2,
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
  category?: string
  isCategorySuggested?: boolean
}

type KnowledgeEntry = {
  id: string
  title: string
  shortAnswer: string
  answer: string
  sourceLabel: string
  sourceType?: "handbook" | "center_update" | "staff_policy" | "other_approved_source" | null
  category: string
  isFeatured: boolean
  status?: "published" | "draft"
  tags?: string[]
  featuredOrder?: number | null
  startsAt?: string | null
  endsAt?: string | null
}

type Suggestion = {
  id: string
  title: string
  reason: string
  questionCount: number
}

type Recommendation = {
  id: string
  kind: "faq" | "staff_answer" | "handbook_update"
  title: string
  shortAnswer: string
  answer: string
  sourceLabel: string
  tags?: string[]
  sourceType?: "handbook" | "center_update" | "staff_policy" | "other_approved_source"
  category: string
  isFeatured: boolean
  startsAt?: string
  endsAt?: string
  rationale: string
  evidence: string | string[]
  requiresStaffInput?: boolean
  target?: string
  sourceKnowledgeId?: string | null
  operation?: "create" | "update"
  topicId?: string
  status: "pending"
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
  sourceType: "handbook" | "center_update" | "staff_policy" | "other_approved_source"
  category: string
  isFeatured: boolean
  tags: string[]
  startsAt: string
  endsAt: string
}

const emptyDraft: KnowledgeDraft = {
  title: "",
  shortAnswer: "",
  answer: "",
  sourceLabel: "",
  sourceType: "handbook",
  category: "General",
  isFeatured: false,
  tags: [],
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
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date)
}

function questionDayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "unknown"
  return questionDateKey(date)
}

function questionDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatQuestionDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date unavailable"
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date)
  if (questionDayKey(value) === questionDateKey(today)) return `Today · ${dateLabel}`
  if (questionDayKey(value) === questionDateKey(yesterday)) return `Yesterday · ${dateLabel}`
  return dateLabel
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

function toDateInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function humanizeEvidence(value: string) {
  return value.replace(/\bjx[a-z0-9]{20,}\b/gi, "the related question topic")
    .replace(/\bjh[a-z0-9]{20,}\b/gi, "the linked handbook section")
    .replace(/(?:published center knowledge|published source) the linked handbook section/gi, "the linked handbook section")
    .replace(/question group the related question topic/gi, "the related question topic")
    .replace(/question groups the related question topic/gi, "the related question topic")
}

export default function AdminConsole() {
  const [data, setData] = useState<AdminData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<"dashboard" | "recommendations" | "questions" | "topics" | "handbook" | "featured" | "announcement">("dashboard")
  const shouldScrollToViewRef = useRef(false)
  const shouldWaitForInitialLoadRef = useRef(false)
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
  const [announcement, setAnnouncement] = useState({ title: "", message: "", isActive: false })
  const hasEditedAnnouncementRef = useRef(false)
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false)
  const [announcementError, setAnnouncementError] = useState("")
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pin, setPin] = useState("")
  const [authError, setAuthError] = useState("")
  const [isLoadingOlderQuestions, setIsLoadingOlderQuestions] = useState(false)
  const [olderQuestionsError, setOlderQuestionsError] = useState("")
  const [questionOutcomeFilter, setQuestionOutcomeFilter] = useState<"all" | "answered" | "needs_staff">("all")
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recommendationSearch, setRecommendationSearch] = useState("")
  const [recommendationFilter, setRecommendationFilter] = useState<"all" | "ready" | "staff">("all")
  const [recommendationTagFilter, setRecommendationTagFilter] = useState("all")
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationError, setRecommendationError] = useState("")
  const [recommendationActionId, setRecommendationActionId] = useState<string | null>(null)
  const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null)
  const [handbookSearch, setHandbookSearch] = useState("")
  const [handbookTagFilter, setHandbookTagFilter] = useState("all")
  const [featuredSearch, setFeaturedSearch] = useState("")
  const [featuredTagFilter, setFeaturedTagFilter] = useState("all")
  const [featuredOrder, setFeaturedOrder] = useState<string[]>([])
  const [isSavingFeaturedOrder, setIsSavingFeaturedOrder] = useState(false)
  const [featuredOrderError, setFeaturedOrderError] = useState("")
  const [draggedFeaturedId, setDraggedFeaturedId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState("")

  const closeEditor = useCallback(function closeEditor() {
    setIsEditing(false)
    setEditingRecommendationId(null)
    setDraft(emptyDraft)
    setSaveError("")
    setRecommendationError("")
    setAssistSuggestions([])
    setAssistError("")
    setTagInput("")
  }, [])

  function selectView(view: "dashboard" | "recommendations" | "questions" | "topics" | "handbook" | "featured" | "announcement") {
    closeEditor()
    shouldScrollToViewRef.current = true
    if (activeView === view) {
      requestAnimationFrame(() => {
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        shouldScrollToViewRef.current = false
      })
      return
    }
    setActiveView(view)
  }

  useEffect(() => {
    if (!shouldScrollToViewRef.current) return
    if (shouldWaitForInitialLoadRef.current && (isLoading || isLoadingRecommendations)) return
    requestAnimationFrame(() => {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      shouldScrollToViewRef.current = false
      shouldWaitForInitialLoadRef.current = false
    })
  }, [activeView, isLoading, isLoadingRecommendations])

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view")
    const view = requestedView === "stream" ? "questions" : requestedView === "inbox" ? "topics" : requestedView
    if (view !== "dashboard" && view !== "recommendations" && view !== "questions" && view !== "topics" && view !== "handbook" && view !== "featured" && view !== "announcement") return
    shouldScrollToViewRef.current = true
    shouldWaitForInitialLoadRef.current = true
    setActiveView(view)
  }, [])

  const loadRecommendations = useCallback(async function loadRecommendations() {
    setIsLoadingRecommendations(true)
    setRecommendationError("")
    try {
      const response = await fetch("/api/admin/recommendations", { cache: "no-store" })
      if (!response.ok) throw new Error("Recommendations could not be loaded.")
      const result = (await response.json()) as { recommendations: Recommendation[] }
      setRecommendations(result.recommendations ?? [])
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "Recommendations could not be loaded.")
    } finally {
      setIsLoadingRecommendations(false)
    }
  }, [])

  async function updateRecommendation(id: string, action: "approve" | "edit" | "dismiss", fields?: KnowledgeDraft) {
    setRecommendationActionId(id)
    setRecommendationError("")
    try {
      const response = await fetch("/api/admin/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(fields ? { entry: { ...fields, startsAt: fields.startsAt || undefined, endsAt: fields.endsAt || undefined } } : {}) }),
      })
      if (!response.ok) throw new Error(action === "approve" ? "The recommended update could not be published." : action === "edit" ? "The recommendation changes could not be saved." : "The recommendation could not be dismissed.")
      if (action === "edit" && fields) {
        setRecommendations((current) => current.map((recommendation) => recommendation.id === id ? { ...recommendation, ...fields, startsAt: fields.startsAt || undefined, endsAt: fields.endsAt || undefined, requiresStaffInput: false } : recommendation))
      } else {
        setRecommendations((current) => current.filter((recommendation) => recommendation.id !== id))
      }
      setToast(action === "approve" ? "Recommended update published and live for parents." : action === "edit" ? "Recommendation changes saved. Approve when they’re ready to publish." : "Recommendation dismissed.")
      setEditingRecommendationId(null)
      setIsEditing(false)
      if (action === "approve") await loadData(false)
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "The recommendation could not be updated.")
    } finally {
      setRecommendationActionId(null)
    }
  }

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
      setFeaturedOrder((current) => {
        const featuredEntries = result.knowledge.filter((entry) => entry.isFeatured && entry.status !== "draft")
          .sort((a, b) => (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER))
        const serverOrder = featuredEntries.map((entry) => entry.id)
        return current.length ? [...current.filter((id) => serverOrder.includes(id)), ...serverOrder.filter((id) => !current.includes(id))] : serverOrder
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
    if (isAuthenticated) {
      void loadData()
      void loadRecommendations()
      void fetch("/api/admin/announcement", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error("Family announcement could not be loaded.")
        return response.json() as Promise<{ title: string; message: string; isActive: boolean }>
      }).then((result) => { if (!hasEditedAnnouncementRef.current) setAnnouncement(result) }).catch((error: unknown) => setAnnouncementError(error instanceof Error ? error.message : "Family announcement could not be loaded."))
    }
  }, [isAuthenticated, loadData, loadRecommendations])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(""), 5000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function saveAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAnnouncementError("")
    setIsSavingAnnouncement(true)
    try {
      const response = await fetch("/api/admin/announcement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(announcement) })
      if (!response.ok) throw new Error("Family announcement could not be saved.")
      setToast(announcement.isActive ? "Family announcement is live on the front desk." : "Family announcement saved as inactive.")
    } catch (error) {
      setAnnouncementError(error instanceof Error ? error.message : "Family announcement could not be saved.")
    } finally {
      setIsSavingAnnouncement(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadData(false)
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [isAuthenticated, loadData])

  useEffect(() => {
    if (!isEditing) return
    function handleEditorKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeEditor()
    }
    window.addEventListener("keydown", handleEditorKeyDown)
    return () => window.removeEventListener("keydown", handleEditorKeyDown)
  }, [isEditing, closeEditor])

  const visibleTopics = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.topics ?? []).filter((topic) => !query || topic.title.toLowerCase().includes(query) || topic.examples.some((example) => example.toLowerCase().includes(query)))
  }, [data?.topics, search])

  const selectedTopic = visibleTopics.find((topic) => topic.id === selectedTopicId) ?? visibleTopics[0]
  const topicGroups = useMemo(() => {
    const groups = new Map<string, Topic[]>()
    for (const topic of visibleTopics) {
      const category = topic.category?.trim() || "Other questions"
      groups.set(category, [...(groups.get(category) ?? []), topic])
    }
    return [...groups.entries()]
  }, [visibleTopics])
  const visibleRecommendations = useMemo(() => {
    const query = recommendationSearch.trim().toLowerCase()
    return recommendations.filter((recommendation) => {
      const matchesQuery = !query || [recommendation.title, recommendation.shortAnswer, recommendation.answer, recommendation.category, recommendation.sourceLabel, ...(recommendation.tags ?? [])].some((value) => value.toLowerCase().includes(query))
      const matchesFilter = recommendationFilter === "all" || (recommendationFilter === "staff" ? recommendation.requiresStaffInput : !recommendation.requiresStaffInput)
      const matchesTag = recommendationTagFilter === "all" || (recommendation.tags ?? []).includes(recommendationTagFilter)
      return matchesQuery && matchesFilter && matchesTag
    })
  }, [recommendationFilter, recommendationSearch, recommendationTagFilter, recommendations])
  const recommendationTags = useMemo(() => [...new Set(recommendations.flatMap((recommendation) => recommendation.tags ?? []))].sort(), [recommendations])
  const sourceOptions = useMemo(() => [...new Set([
    "Family handbook", "Center policy", "Center update", "Center website",
    ...(data?.knowledge ?? []).map((entry) => entry.sourceLabel),
    ...recommendations.map((entry) => entry.sourceLabel),
  ].map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [data?.knowledge, recommendations])
  const handbookTags = useMemo(() => [...new Set((data?.knowledge ?? []).flatMap((entry) => entry.tags ?? []))].sort(), [data?.knowledge])
  const visibleHandbook = useMemo(() => {
    const query = handbookSearch.trim().toLowerCase()
    return (data?.knowledge ?? []).filter((entry) => {
      const matchesText = !query || [entry.title, entry.shortAnswer, entry.answer, entry.sourceLabel, entry.category, ...(entry.tags ?? [])].some((value) => value.toLowerCase().includes(query))
      return matchesText && (handbookTagFilter === "all" || (entry.tags ?? []).includes(handbookTagFilter))
    })
  }, [data?.knowledge, handbookSearch, handbookTagFilter])
  const featuredEntries = useMemo(() => {
    const byId = new Map((data?.knowledge ?? []).filter((entry) => entry.isFeatured && entry.status !== "draft").map((entry) => [entry.id, entry]))
    return featuredOrder.map((id) => byId.get(id)).filter((entry): entry is KnowledgeEntry => Boolean(entry))
  }, [data?.knowledge, featuredOrder])
  const availableFeaturedEntries = useMemo(() => {
    const query = featuredSearch.trim().toLowerCase()
    return (data?.knowledge ?? []).filter((entry) => {
      const matchesText = !query || [entry.title, entry.shortAnswer, entry.category, entry.sourceLabel, ...(entry.tags ?? [])].some((value) => value.toLowerCase().includes(query))
      return matchesText && (featuredTagFilter === "all" || (entry.tags ?? []).includes(featuredTagFilter))
    })
  }, [data?.knowledge, featuredSearch, featuredTagFilter])
  const unansweredCount = (data?.topics ?? []).filter((topic) => topic.status === "needs_answer").length
  const visibleQuestionEvents = useMemo(() => (data?.questions ?? []).filter((event) => questionOutcomeFilter === "all" || event.outcome === questionOutcomeFilter), [data?.questions, questionOutcomeFilter])
  const questionDays = useMemo(() => {
    const groups = new Map<string, QuestionEvent[]>()
    const sortedEvents = [...visibleQuestionEvents].sort((first, second) => new Date(second.askedAt).getTime() - new Date(first.askedAt).getTime())
    for (const event of sortedEvents) {
      const key = questionDayKey(event.askedAt)
      groups.set(key, [...(groups.get(key) ?? []), event])
    }
    return [...groups.entries()].map(([key, events]) => ({ key, events, label: formatQuestionDay(events[0]?.askedAt ?? "") }))
  }, [visibleQuestionEvents])
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
    setEditingRecommendationId(null)
    setDraft({ ...emptyDraft, ...prefill, tags: prefill?.tags ?? [] })
    setSaveError("")
    setAssistSuggestions([])
    setIsEditing(true)
  }

  function openEntry(entry: KnowledgeEntry) {
    setEditingRecommendationId(null)
    setDraft({
      id: entry.id,
      title: entry.title,
      shortAnswer: entry.shortAnswer,
      answer: entry.answer,
      sourceLabel: entry.sourceLabel,
      sourceType: entry.sourceType ?? "handbook",
      category: entry.category,
      isFeatured: entry.isFeatured,
      tags: entry.tags ?? [],
      startsAt: toDateInput(entry.startsAt),
      endsAt: toDateInput(entry.endsAt),
    })
    setSaveError("")
    setIsEditing(true)
  }

  function addDraftTag() {
    const nextTag = tagInput.trim().replace(/\s+/g, " ")
    if (!nextTag) return
    setDraft((current) => current.tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase()) ? current : { ...current, tags: [...current.tags, nextTag] })
    setTagInput("")
  }

  async function persistFeaturedOrder(nextOrder: string[]) {
    setFeaturedOrder(nextOrder)
    setFeaturedOrderError("")
    setIsSavingFeaturedOrder(true)
    try {
      const response = await fetch("/api/admin/featured-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedIds: nextOrder }) })
      if (!response.ok) throw new Error("Front desk order could not be saved.")
      const result = await response.json() as { orderedIds: string[] }
      setFeaturedOrder(result.orderedIds)
      setToast("Front desk FAQ order saved.")
    } catch (error) {
      setFeaturedOrderError(error instanceof Error ? error.message : "Front desk order could not be saved.")
      void loadData(false)
    } finally {
      setIsSavingFeaturedOrder(false)
    }
  }

  async function setFeatured(entry: KnowledgeEntry, isFeatured: boolean) {
    if (entry.status === "draft") {
      setFeaturedOrderError("Publish this handbook answer before adding it to the front desk.")
      return
    }
    setFeaturedOrderError("")
    try {
      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, title: entry.title, shortAnswer: entry.shortAnswer, answer: entry.answer, sourceLabel: entry.sourceLabel, sourceType: entry.sourceType ?? "handbook", category: entry.category, tags: entry.tags ?? [], isFeatured, startsAt: entry.startsAt ? toDateInput(entry.startsAt) : null, endsAt: entry.endsAt ? toDateInput(entry.endsAt) : null, status: entry.status ?? "published" }),
      })
      if (!response.ok) throw new Error("The front desk selection could not be updated.")
      setToast(isFeatured ? "Answer added to the family front desk." : "Answer removed from the family front desk.")
      await loadData(false)
    } catch (error) {
      setFeaturedOrderError(error instanceof Error ? error.message : "The front desk selection could not be updated.")
    }
  }

  function moveFeatured(entryId: string, offset: -1 | 1) {
    const currentIndex = featuredOrder.indexOf(entryId)
    const nextIndex = currentIndex + offset
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= featuredOrder.length) return
    const nextOrder = [...featuredOrder]
    const [movedId] = nextOrder.splice(currentIndex, 1)
    nextOrder.splice(nextIndex, 0, movedId)
    void persistFeaturedOrder(nextOrder)
  }

  async function saveKnowledge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingRecommendationId) {
      await updateRecommendation(editingRecommendationId, "edit", draft)
      return
    }
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
    return <div className="flex min-h-screen items-center justify-center bg-background px-4"><Card className="w-full max-w-md shadow-sm"><CardHeader><div className="mb-4"><Logo size={36} /></div><CardTitle className="text-2xl font-bold">Staff access</CardTitle><CardDescription>Enter your center PIN to manage brightflare answers and family questions.</CardDescription></CardHeader><CardContent><form onSubmit={signIn} className="flex flex-col gap-4">{authError && <p className="text-sm text-destructive" role="alert">{authError}</p>}<label className="flex flex-col gap-2 text-sm font-medium" htmlFor="admin-pin">Center PIN<Input id="admin-pin" autoComplete="current-password" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} required /></label><Button className="w-full" disabled={!pin.trim()}>Continue</Button></form></CardContent></Card></div>
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1440px] bg-background shadow-sm">
        <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r bg-card px-3 py-5 max-md:hidden">
          <a href="/admin" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1.5"><Logo size={32} variant="mark" /><span className="font-bold tracking-tight">brightflare <span className="font-medium text-muted-foreground">Admin</span></span></a>
          <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</div>
          <nav aria-label="Admin navigation" className="space-y-1">
            <AdminNavButton active={activeView === "dashboard"} icon={<LayoutDashboard />} label="Dashboard" onClick={() => selectView("dashboard")} />
            <AdminNavButton active={activeView === "recommendations"} icon={<ClipboardCheck />} label="Recommendations" count={recommendations.length} onClick={() => selectView("recommendations")} />
            <button type="button" aria-pressed={activeView === "questions"} onClick={() => selectView("questions")} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeView === "questions" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}><MessageCircle aria-hidden="true" className="size-4" />Questions</button>
            <button type="button" aria-pressed={activeView === "topics"} onClick={() => selectView("topics")} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeView === "topics" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}><CircleHelp aria-hidden="true" className="size-4" />Question topics<Badge variant="secondary" className="ml-auto">{unansweredCount}</Badge></button>
            <button type="button" aria-pressed={activeView === "handbook"} onClick={() => selectView("handbook")} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeView === "handbook" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}><BookOpen aria-hidden="true" className="size-4" />Handbook</button>
            <button type="button" aria-pressed={activeView === "featured"} onClick={() => selectView("featured")} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${activeView === "featured" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}><GripVertical aria-hidden="true" className="size-4" />Front desk layout</button>
            <AdminNavButton active={activeView === "announcement"} icon={<Megaphone />} label="Announcement" onClick={() => selectView("announcement")} />
          </nav>
          <div className="mt-auto border-t pt-4"><a href="/admin/settings" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Settings2 className="size-4" />Center settings</a><p className="mt-3 truncate px-3 text-xs text-muted-foreground">{data?.center.name ?? "Center knowledge"}</p></div>
        </aside>
        <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-8"><div className="text-sm font-medium text-muted-foreground">Center workspace</div><a href="/admin/settings" aria-label="Center settings" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"><Settings2 className="size-4" /></a></header>
        <nav aria-label="Mobile admin navigation" className="sticky top-14 z-20 flex gap-2 overflow-x-auto border-b bg-card px-4 py-2 md:hidden">
          <Button type="button" aria-pressed={activeView === "dashboard"} size="sm" variant={activeView === "dashboard" ? "default" : "outline"} onClick={() => selectView("dashboard")}>Dashboard</Button>
          <Button type="button" aria-pressed={activeView === "recommendations"} size="sm" variant={activeView === "recommendations" ? "default" : "outline"} onClick={() => selectView("recommendations")}>Recommendations ({recommendations.length})</Button>
          <Button type="button" aria-pressed={activeView === "questions"} size="sm" variant={activeView === "questions" ? "default" : "outline"} onClick={() => selectView("questions")}>Questions</Button>
          <Button type="button" aria-pressed={activeView === "topics"} size="sm" variant={activeView === "topics" ? "default" : "outline"} onClick={() => selectView("topics")}>Topics ({unansweredCount})</Button>
          <Button type="button" aria-pressed={activeView === "handbook"} size="sm" variant={activeView === "handbook" ? "default" : "outline"} onClick={() => selectView("handbook")}>Handbook</Button>
          <Button type="button" aria-pressed={activeView === "featured"} size="sm" variant={activeView === "featured" ? "default" : "outline"} onClick={() => selectView("featured")}>Front desk</Button>
          <Button type="button" aria-pressed={activeView === "announcement"} size="sm" variant={activeView === "announcement" ? "default" : "outline"} onClick={() => selectView("announcement")}>Announcement</Button>
        </nav>

      <main className="mx-auto max-w-[1200px] px-4 py-7 sm:px-8 lg:py-9">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-3xl">{activeView === "dashboard" ? "Good morning, team" : activeView === "recommendations" ? "Recommendations" : activeView === "questions" ? "Family questions" : activeView === "topics" ? "Question topics" : activeView === "featured" ? "Front desk layout" : activeView === "announcement" ? "Family announcement" : "Center handbook"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{activeView === "dashboard" ? "See what needs attention and open the right workspace." : activeView === "recommendations" ? "Review grounded suggestions before they become part of your family handbook." : activeView === "questions" ? "Follow the latest questions families bring to the front desk." : activeView === "topics" ? "Group similar questions and turn unanswered topics into verified answers." : activeView === "featured" ? "Preview and arrange the FAQ cards families see first." : activeView === "announcement" ? "Share a timely update with families from the front desk." : "Find approved answers, their sources, and related tags."}</p>
          </div>
          <Button type="button" onClick={() => openNewEntry()} className="gap-2"><Plus className="h-4 w-4" /> Add an answer</Button>
        </div>

        {loadError && <Alert variant="destructive" className="mb-5"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t load your center data</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{loadError}<Button variant="outline" size="sm" onClick={() => void loadData()}>Try again</Button></AlertDescription></Alert>}

        <div>
        {isLoading && !data ? <Card className="flex min-h-72 items-center justify-center"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading your center…</div></Card> : activeView === "dashboard" ? (
          <div className="space-y-5">
            <SectionHeading title="Your center at a glance" description="Start with items that need attention, then open the workspace you need." />
            <div className="grid gap-3 md:grid-cols-3">
              <DashboardCard icon={<ClipboardCheck className="size-4" />} title="Recommendations" value={isLoadingRecommendations ? "—" : String(recommendations.length)} description="Updates ready for your review" action="Review recommendations" onClick={() => selectView("recommendations")} />
              <DashboardCard icon={<CircleHelp className="size-4" />} title="Question topics" value={String(unansweredCount)} description="Topics without an approved answer" action="Review question topics" onClick={() => selectView("topics")} />
              <DashboardCard icon={<MessageCircle className="size-4" />} title="Family questions" value={String((data?.questions ?? []).filter((event) => Date.now() - new Date(event.askedAt).getTime() < 86_400_000).length)} description="Asked in the last 24 hours" action="Open question stream" onClick={() => selectView("questions")} />
            </div>
            <Card className="shadow-sm"><CardHeader className="flex-row items-center justify-between gap-3 border-b"><SectionHeading title="Recent family questions" description="A quick pulse from the front desk." /><Button type="button" variant="outline" size="sm" onClick={() => selectView("questions")}>View all</Button></CardHeader><div className="divide-y">{(data?.questions ?? []).slice(0, 4).map((event) => <div key={event.id} className="relative px-5 py-3 pl-7"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${event.outcome === "answered" ? "bg-emerald-500" : "bg-amber-500"}`} /><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{event.outcome === "answered" ? "Answered" : "Needs staff"}</Badge><time dateTime={event.askedAt} className="text-xs text-muted-foreground">{formatQuestionDay(event.askedAt)} at {formatQuestionTime(event.askedAt)}</time></div><p className="mt-1 text-sm font-medium">{event.isPrivate ? "A private family question was asked." : event.question}</p></div>)}{!data?.questions.length && <p className="p-6 text-sm text-muted-foreground">Family questions will appear here as they come in.</p>}</div></Card>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => selectView("handbook")}>Open handbook</Button><Button type="button" variant="outline" onClick={() => selectView("featured")}>Arrange front desk cards</Button><Button type="button" variant="outline" onClick={() => selectView("announcement")}>Edit family announcement</Button></div>
          </div>
        ) : activeView === "recommendations" ? (
        <section aria-labelledby="recommendations-heading" className="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading id="recommendations-heading" title="Recommended updates" description="Review suggested answers before they appear in your family handbook." />
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">{recommendations.length} to review</span>
          </div>
          {recommendationError && <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-sm text-destructive" role="alert">{recommendationError}<Button variant="outline" size="sm" onClick={() => void loadRecommendations()}>Try again</Button></div>}
          {recommendations.length > 0 && <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search recommendations" placeholder="Search questions, answers, sources, and tags" value={recommendationSearch} onChange={(event) => setRecommendationSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter recommendations by tag" value={recommendationTagFilter} onChange={(event) => setRecommendationTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All tags</option>{recommendationTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div><fieldset className="flex gap-1 rounded-lg bg-muted p-1"><legend className="sr-only">Filter recommendations</legend>{(["all", "ready", "staff"] as const).map((filter) => <button type="button" key={filter} aria-pressed={recommendationFilter === filter} onClick={() => setRecommendationFilter(filter)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${recommendationFilter === filter ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{filter === "all" ? "All" : filter === "ready" ? "Ready to publish" : "Needs staff"}</button>)}</fieldset></div>}
          {isLoadingRecommendations && recommendations.length === 0 ? <div className="px-5 py-6 text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Looking for useful FAQ updates…</div> : visibleRecommendations.length ? <div className="divide-y divide-border">{visibleRecommendations.map((recommendation) => <article key={recommendation.id} className="relative grid gap-4 px-5 py-4 pl-7 lg:grid-cols-[minmax(0,1fr)_auto]"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${recommendation.requiresStaffInput ? "bg-amber-500" : "bg-emerald-500"}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={recommendation.requiresStaffInput ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>{recommendation.requiresStaffInput ? <><CircleHelp className="mr-1 size-3.5" />Needs staff</> : <><CheckCircle2 className="mr-1 size-3.5" />Ready to publish</>}</Badge><span className="text-xs text-muted-foreground">{recommendation.category} · {recommendation.operation === "update" ? "Update existing section" : recommendation.kind === "handbook_update" ? "Handbook article" : "New FAQ"}</span></div><h3 className="mt-2 font-semibold leading-snug">{recommendation.title}</h3><p className="mt-1 text-sm text-muted-foreground">{recommendation.shortAnswer}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{humanizeEvidence(Array.isArray(recommendation.evidence) ? recommendation.evidence.join(" · ") : recommendation.evidence)}</p><p className="mt-1 text-xs text-muted-foreground">{recommendation.requiresStaffInput ? "Needs center details" : <>Source: {recommendation.sourceKnowledgeId ? <a href={`/handbook/${encodeURIComponent(recommendation.sourceKnowledgeId)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{recommendation.sourceLabel}</a> : recommendation.sourceLabel}</>}</p></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><Button size="sm" className="gap-1.5" disabled={recommendationActionId === recommendation.id || recommendation.requiresStaffInput} onClick={() => void updateRecommendation(recommendation.id, "approve")}><Check className="size-4" />Approve</Button><Button size="sm" variant="outline" disabled={recommendationActionId === recommendation.id} onClick={() => { setEditingRecommendationId(recommendation.id); setDraft({ title: recommendation.title, shortAnswer: recommendation.shortAnswer, answer: recommendation.answer, sourceLabel: recommendation.sourceLabel, sourceType: recommendation.sourceType ?? "handbook", category: recommendation.category, isFeatured: recommendation.isFeatured, tags: recommendation.tags ?? [], startsAt: toDateInput(recommendation.startsAt), endsAt: toDateInput(recommendation.endsAt), topicId: recommendation.topicId }); setSaveError(""); setIsEditing(true) }}>Edit</Button><Button size="sm" variant="ghost" disabled={recommendationActionId === recommendation.id} onClick={() => void updateRecommendation(recommendation.id, "dismiss")}>Dismiss</Button></div></article>)}</div> : <p className="px-5 py-6 text-sm text-muted-foreground">{recommendations.length ? "No recommendations match these filters." : "No updates need review right now. New suggestions will appear as families ask questions the handbook could answer better."}</p>}
        </section>
        ) : activeView === "questions" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0 shadow-sm">
              <CardHeader className="border-b-2 pb-4">
                <SectionHeading title="What families are asking" description="Recent parent questions update every 15 seconds. Private child questions appear without names or message details." />
                <fieldset className="mt-4 flex w-fit gap-1 rounded-lg bg-muted p-1"><legend className="sr-only">Filter family questions</legend>{(["all", "needs_staff", "answered"] as const).map((filter) => <button type="button" key={filter} aria-pressed={questionOutcomeFilter === filter} onClick={() => setQuestionOutcomeFilter(filter)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${questionOutcomeFilter === filter ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{filter === "all" ? "All questions" : filter === "needs_staff" ? "Needs staff" : "Answered"}</button>)}</fieldset>
              </CardHeader>
              <div className="divide-y">
                {questionDays.length ? questionDays.map((day) => <section key={day.key} aria-label={`Family questions from ${day.label}`}>
                  <div className="flex items-center justify-between gap-3 bg-muted/50 px-5 py-2.5"><h3 className="text-sm font-semibold">{day.label}</h3><span className="text-xs text-muted-foreground">{day.events.length} {day.events.length === 1 ? "question" : "questions"}</span></div>
                  <div className="ml-5 border-l-2 border-border">
                    {day.events.map((event) => <article key={event.id} className="relative flex flex-col gap-3 border-b px-5 py-4 pl-7 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
                      <span aria-hidden="true" className={`absolute -left-[7px] top-5 size-3 rounded-full border-2 border-background ${event.outcome === "answered" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={event.outcome === "answered" ? "bg-brand-teal text-foreground" : "bg-brand-amber text-foreground"}>{event.outcome === "answered" ? "Answered" : "Needs staff"}</Badge>
                          <time dateTime={event.askedAt} className="text-xs text-muted-foreground">{formatQuestionTime(event.askedAt)}</time>
                        </div>
                        <p className="text-sm font-semibold leading-snug sm:text-base">{event.isPrivate ? "Private child question" : event.question}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{event.isPrivate ? "Private family question" : event.topicTitle ? `Topic: ${event.topicTitle}` : "No grouped topic yet"} · {event.sourceStatus === "sourced" ? "Sourced answer" : "No verified source"}</p>
                      </div>
                      {event.topicId ? <Button type="button" variant="outline" size="sm" className="shrink-0 self-start" onClick={() => { setSelectedTopicId(event.topicId); selectView("topics") }}>Review topic<ChevronRight data-icon="inline-end" /></Button> : null}
                    </article>)}
                  </div>
                </section>) : <div className="p-8 text-center text-sm text-muted-foreground">{(data?.questions ?? []).length ? "No questions match this filter." : "New parent questions will appear here as they are asked."}</div>}
              </div>
              {data?.questionCursor ? <div className="flex flex-col items-center gap-2 border-t px-5 py-4"><Button type="button" variant="outline" onClick={() => void loadOlderQuestions()} disabled={isLoadingOlderQuestions}>{isLoadingOlderQuestions ? "Loading earlier questions…" : "Load earlier questions"}</Button>{olderQuestionsError ? <p role="alert" className="text-sm text-destructive">{olderQuestionsError}</p> : null}</div> : null}
            </Card>
            <Card className="self-start bg-accent">
              <CardHeader><SectionHeading title="Turn demand into answers" description="Questions with no verified source become topics for your team to review." /></CardHeader>
              <CardContent className="space-y-3"><p className="text-sm">{unansweredCount} topics need an approved answer. Similar questions are grouped so one handbook update can help many families.</p><Button variant="outline" className="w-full bg-card" onClick={() => selectView("topics")}>Review topics<ArrowUpRight data-icon="inline-end" /></Button></CardContent>
            </Card>
          </div>
        ) : activeView === "topics" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.88fr)]">
            <Card className="min-w-0 shadow-sm">
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading title="Questions families are asking" description="Similar questions are grouped into topics. Counts use anonymous sessions." />
                  <Badge variant="secondary">{unansweredCount} need attention</Badge>
                </div>
                <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search question topics" placeholder="Search topics or parent wording" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
              </CardHeader>
              <div className="divide-y">
                {topicGroups.length ? topicGroups.map(([category, topics]) => <section key={category} aria-label={`${category} category`}>
                  <h3 className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}{topics.some((topic) => topic.isCategorySuggested) && <span className="font-normal normal-case tracking-normal">Suggested</span>}</h3>
                  {topics.map((topic) => <button type="button" key={topic.id} onClick={() => { setSelectedTopicId(topic.id); setAssistSuggestions([]); setAssistError("") }} className={`relative w-full px-4 py-3 pl-7 text-left transition-colors hover:bg-muted/50 ${topic.id === selectedTopic?.id ? "bg-muted" : ""}`}><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${topic.status === "needs_answer" ? "bg-amber-500" : topic.status === "needs_review" ? "bg-blue-500" : "bg-emerald-500"}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={statusVariant(topic.status)}>{statusLabel(topic.status)}</Badge><span className="text-xs text-muted-foreground">{formatRelativeTime(topic.lastAskedAt)}</span></div><p className="font-medium leading-snug">{topic.title}</p><p className="mt-1 line-clamp-1 text-sm text-muted-foreground">“{topic.examples[0] ?? "Parent question"}”</p></div>
                      <div className="shrink-0 text-right"><div className="text-lg font-semibold tabular-nums">{topic.questionCount}</div><div className="text-xs text-muted-foreground">questions</div><div className="mt-1 text-xs text-muted-foreground">{topic.sessionCount} sessions</div></div>
                    </div>
                  </button>)}
                </section>) : <div className="p-10 text-center text-sm text-muted-foreground">No question topics match that search.</div>}
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="shadow-sm">
                {selectedTopic ? <>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between gap-3"><Badge variant={statusVariant(selectedTopic.status)}>{statusLabel(selectedTopic.status)}</Badge><span className="text-xs text-muted-foreground">Last asked {formatRelativeTime(selectedTopic.lastAskedAt).toLowerCase()}</span></div>
                    <CardTitle className="text-lg leading-snug sm:text-xl">{selectedTopic.title}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 pt-1"><span>{selectedTopic.questionCount} questions</span><span>·</span><span>{selectedTopic.sessionCount} anonymous sessions</span></CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div><h3 className="mb-2 text-sm font-semibold">How families ask</h3><div className="flex flex-col gap-2">{selectedTopic.examples.slice(0, 3).map((example, index) => <p key={`${example}-${index}`} className="border px-3 py-2 text-sm text-muted-foreground">“{example}”</p>)}</div><p className="mt-2 text-xs text-muted-foreground">Names and child details are removed from this view.</p></div>
                    <div className="border p-4"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><WandSparkles className="size-4 text-primary" /> Admin assistant</div><p className="text-sm text-muted-foreground">Use center history to draft a response or shape this into a short front desk FAQ. You approve every change.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button variant="outline" size="sm" className="justify-start gap-2" disabled={assistMode !== null} onClick={() => void askAssistant("knowledge", selectedTopic)}>{assistMode === "knowledge" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <WandSparkles data-icon="inline-start" />} Draft an answer</Button><Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}><Plus data-icon="inline-start" /> Add to handbook</Button></div></div>
                    {assistError && <p className="text-sm text-destructive" role="alert">{assistError}</p>}
                    {assistResultMode === "knowledge" && assistSuggestions.length > 0 && <div className="border bg-card p-3"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Assistant suggestions</span><Button size="sm" variant="ghost" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, answer: assistSuggestions[0], category: "Family questions" })}>Review & edit <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div><p className="line-clamp-4 text-sm text-muted-foreground">{assistSuggestions[0]}</p></div>}
                    {selectedTopic.status === "needs_answer" && <Button className="w-full gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}>Write an approved answer <ChevronRight className="h-4 w-4" /></Button>}
                  </CardContent>
                </> : <div className="p-12 text-center text-sm text-muted-foreground">No topics yet. Parent questions will appear here as they come in.</div>}
              </Card>
              <SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} />
            </div>
          </div>
        ) : activeView === "featured" ? (
          <div className="space-y-5">
            <SectionHeading title="Front desk layout" description="Preview and arrange the featured FAQ cards families see first." />
            {featuredOrderError && <Alert variant="destructive"><CircleHelp className="size-4" /><AlertDescription>{featuredOrderError}</AlertDescription></Alert>}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <Card className="shadow-sm">
                <CardHeader className="border-b"><SectionHeading title="Family preview" description="Cards appear in this order on the parent front desk." /></CardHeader>
                <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                  {featuredEntries.map((entry, index) => <article key={entry.id} draggable onDragStart={() => setDraggedFeaturedId(entry.id)} onDragEnd={() => setDraggedFeaturedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!draggedFeaturedId || draggedFeaturedId === entry.id) return; const next = [...featuredOrder]; const from = next.indexOf(draggedFeaturedId); const to = next.indexOf(entry.id); next.splice(from, 1); next.splice(to, 0, draggedFeaturedId); setDraggedFeaturedId(null); void persistFeaturedOrder(next) }} className="relative flex min-h-36 cursor-grab flex-col overflow-hidden rounded-md border bg-background p-4 pl-5 shadow-sm active:cursor-grabbing">
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${["bg-primary", "bg-teal-500", "bg-pink-500", "bg-amber-500"][index % 4]}`} />
                    <div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="mb-2 text-[10px]">{entry.category}</Badge><h3 className="font-semibold leading-snug">{entry.title}</h3></div><GripVertical aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" /></div><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{entry.shortAnswer}</p>
                    <div className="mt-auto flex items-center justify-between pt-4"><span className="text-xs text-muted-foreground">Card {index + 1}</span><div className="flex gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${entry.title} up`} disabled={index === 0 || isSavingFeaturedOrder} onClick={() => moveFeatured(entry.id, -1)}><ChevronRight className="size-4 -rotate-90" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${entry.title} down`} disabled={index === featuredEntries.length - 1 || isSavingFeaturedOrder} onClick={() => moveFeatured(entry.id, 1)}><ChevronRight className="size-4 rotate-90" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${entry.title} from front desk`} disabled={isSavingFeaturedOrder} onClick={() => void setFeatured(entry, false)}><X className="size-4" /></Button></div></div>
                  </article>)}
                  {!featuredEntries.length && <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No featured answers yet. Add a handbook answer below to build the family view.</p>}
                  {isSavingFeaturedOrder && <output className="col-span-full text-xs text-muted-foreground">Saving front desk order…</output>}
                </CardContent>
              </Card>
              <Card className="shadow-sm"><CardHeader className="border-b"><SectionHeading title="Handbook answers" description="Search approved answers, then add or remove cards from the front desk." /><div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search front desk answers" placeholder="Search answers, sources, or tags" value={featuredSearch} onChange={(event) => setFeaturedSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter front desk answers by tag" value={featuredTagFilter} onChange={(event) => setFeaturedTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All tags</option>{handbookTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div></CardHeader><div className="divide-y">{availableFeaturedEntries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.category} · {entry.sourceLabel}</p></div><Button type="button" size="sm" variant={entry.isFeatured ? "outline" : "default"} disabled={isSavingFeaturedOrder || entry.status === "draft" || (!entry.isFeatured && featuredEntries.length >= 8)} onClick={() => void setFeatured(entry, !entry.isFeatured)}>{entry.status === "draft" ? "Publish first" : entry.isFeatured ? "Remove" : "Add"}</Button></div>)}{!availableFeaturedEntries.length && <p className="p-6 text-sm text-muted-foreground">{data?.knowledge.length ? "No handbook answers match this search." : "Add approved answers to the handbook first."}</p>}</div></Card>
            </div>
          </div>
        ) : activeView === "handbook" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="shadow-sm">
              <CardHeader className="border-b pb-4"><div className="flex items-center justify-between gap-4"><SectionHeading title="Center handbook" description="Approved answers, sourced to your center’s policies and updates." /><Button size="sm" onClick={() => openNewEntry()}><Plus className="mr-1 h-4 w-4" /> Add answer</Button></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search handbook" placeholder="Search answers, sources, and tags" value={handbookSearch} onChange={(event) => setHandbookSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter handbook by tag" value={handbookTagFilter} onChange={(event) => setHandbookTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All tags</option>{handbookTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div></CardHeader>
              <div className="divide-y">{visibleHandbook.map((entry) => <button type="button" key={entry.id} onClick={() => openEntry(entry)} className="relative flex w-full items-start justify-between gap-4 px-5 py-4 pl-7 text-left hover:bg-muted/40"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${entry.isFeatured ? "bg-primary" : "bg-border"}`} /><div className="min-w-0"><p className="font-medium">{entry.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.shortAnswer}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{entry.sourceLabel}</span>{entry.isFeatured && <Badge variant="outline" className="text-[10px]">Shown on front desk</Badge>}{(entry.tags ?? []).map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}</div></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></button>)}{!visibleHandbook.length && <div className="p-10 text-center text-sm text-muted-foreground">{data?.knowledge.length ? "No handbook answers match these filters." : "Your handbook is ready for its first approved answer."}</div>}</div>
            </Card>
            <div className="space-y-5"><SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} /><Card><CardHeader><SectionHeading title="Keep answers current" icon={<Lightbulb className="size-4 text-primary" />} description="Seasonal answers show only during the dates you choose." /></CardHeader><CardContent><p className="text-sm text-muted-foreground">Use effective dates for holidays, weather closures, and school calendar changes. The front desk can show the short answer while parents can open the full policy and source.</p></CardContent></Card></div>
          </div>
        ) : activeView === "announcement" ? (
          <Card className="max-w-3xl shadow-sm"><CardHeader className="border-b"><SectionHeading title="Family announcement" description="Write a short update for families and choose whether it appears on the front desk." /></CardHeader><CardContent className="pt-5"><form onSubmit={saveAnnouncement} onChange={() => { hasEditedAnnouncementRef.current = true }} className="space-y-5">{announcementError && <p role="alert" className="text-sm text-destructive">{announcementError}</p>}<Field label="Announcement title"><Input aria-label="Announcement title" required maxLength={80} value={announcement.title} onChange={(event) => setAnnouncement((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Friday pickup reminder" /></Field><Field label="Message"><Textarea aria-label="Announcement message" required rows={5} maxLength={500} value={announcement.message} onChange={(event) => setAnnouncement((current) => ({ ...current, message: event.target.value }))} placeholder="Share the key details families should know." /><p className="text-right text-xs text-muted-foreground">{announcement.message.length}/500</p></Field><div className="rounded-lg border p-4"><label className="flex cursor-pointer items-start gap-3"><input aria-label="Show announcement on front desk" type="checkbox" checked={announcement.isActive} onChange={(event) => setAnnouncement((current) => ({ ...current, isActive: event.target.checked }))} className="mt-1 size-4 accent-primary" /><span><span className="block text-sm font-medium">Show announcement on the front desk</span><span className="mt-0.5 block text-xs text-muted-foreground">Turn this off to keep the saved announcement here without displaying it to families.</span></span></label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-muted-foreground">Current status: <Badge variant={announcement.isActive ? "default" : "secondary"}>{announcement.isActive ? "Visible to families" : "Saved, inactive"}</Badge></p><Button type="submit" disabled={isSavingAnnouncement || !announcement.title.trim() || !announcement.message.trim()}>{isSavingAnnouncement ? <LoaderCircle className="size-4 animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}{isSavingAnnouncement ? "Saving…" : "Save announcement"}</Button></div></form></CardContent></Card>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a workspace section from the navigation.</p>
        )}
        </div>



      </main>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border bg-background p-4 text-sm shadow-lg"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /><p>{toast}</p><Button type="button" variant="ghost" size="icon" aria-label="Dismiss notification" className="-mr-2 -mt-2 size-8 shrink-0" onClick={() => setToast("")}><X className="size-4" /></Button></div>}

      {isEditing && <div className="fixed inset-0 z-40 flex justify-end bg-foreground/20">
        <button type="button" aria-hidden="true" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={closeEditor} />
        <section role="dialog" aria-modal="true" aria-labelledby="editor-heading" className="relative z-10 flex h-full w-full max-w-lg flex-col overflow-y-auto border-l bg-background">
          <div className="flex items-start justify-between border-b px-6 py-5"><div><h2 id="editor-heading" className="text-lg font-semibold sm:text-xl">{editingRecommendationId ? "Edit recommended content" : draft.id ? "Edit answer" : "Add an answer"}</h2><p className="mt-1 text-sm text-muted-foreground">{editingRecommendationId ? "Save your edits to the recommendation, then approve it to publish." : "Everything here is reviewed by your team before families see it."}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={closeEditor}><X className="size-4" /></Button></div>
          <form onSubmit={saveKnowledge} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
              {saveError && <Alert variant="destructive"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t save this answer</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert>}
              {editingRecommendationId && recommendationError && <p role="alert" className="text-sm text-destructive">{recommendationError}</p>}
              <Field label="FAQ title" hint="Keep it short so it fits on the front desk screen."><div className="flex gap-2"><Input aria-label="FAQ title" required maxLength={65} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Are we open on the teacher workday?" /><Button type="button" variant="outline" size="icon" aria-label="Suggest a shorter FAQ title" title="Suggest a shorter title" disabled={!draft.title || assistMode === "title"} onClick={() => void askAssistant("title")}><WandSparkles className="h-4 w-4" /></Button></div><div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{assistMode === "title" ? "Finding a shorter title…" : "Families see this question first."}</span><span>{draft.title.length}/65</span></div>{assistSuggestions.length > 0 && assistMode === null && <div className="mt-2 flex flex-wrap gap-2">{assistSuggestions.map((suggestion) => <Button key={suggestion} type="button" size="sm" variant="secondary" onClick={() => applySuggestion(suggestion)}>{suggestion}</Button>)}</div>}</Field>
              <Field label="Short answer" hint="One sentence for the front desk card."><Textarea aria-label="Short answer" required rows={2} maxLength={180} value={draft.shortAnswer} onChange={(event) => setDraft((current) => ({ ...current, shortAnswer: event.target.value }))} placeholder="A clear, direct answer in plain language." /><div className="mt-1 text-right text-xs text-muted-foreground">{draft.shortAnswer.length}/180</div></Field>
              <Field label="Full answer"><Textarea aria-label="Full answer" required rows={5} value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Include the details families need and any next step." /></Field>
              <Field label="Source type"><select aria-label="Source type" value={draft.sourceType} onChange={(event) => setDraft((current) => ({ ...current, sourceType: event.target.value as KnowledgeDraft["sourceType"] }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="handbook">Family handbook</option><option value="center_update">Center update</option><option value="staff_policy">Staff policy</option><option value="other_approved_source">Other approved source</option></select></Field>
              <Field label="Citation" hint="Name the specific policy, section, or page families can verify against."><div><Input aria-label="Citation" list="admin-source-labels" required value={draft.sourceLabel} onChange={(event) => setDraft((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="e.g. Family Handbook · Hours & closures" /><datalist id="admin-source-labels">{sourceOptions.map((source) => <option key={source} value={source} />)}</datalist></div></Field>
              <Field label="Category"><Input aria-label="Category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="General, meals, schedule…" /></Field>
              <Field label="Tags" hint="Add a few searchable topics, such as meals, billing, or arrival."><div className="flex gap-2"><Input aria-label="Add tag" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraftTag() } }} placeholder="Add a tag" /><Button type="button" variant="outline" onClick={addDraftTag}>Add tag</Button></div><div className="mt-2 flex flex-wrap gap-2">{draft.tags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">{tag}<button type="button" aria-label={`Remove ${tag} tag`} onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))}><X className="size-3" /></button></Badge>)}</div></Field>
              <div className="border p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => setDraft((current) => ({ ...current, isFeatured: event.target.checked }))} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block text-sm font-medium">Show on front desk</span><span className="mt-0.5 block text-xs text-muted-foreground">Feature this answer as a visible FAQ card for parents.</span></span></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts on" hint="Optional"><Input aria-label="Starts on" type="date" value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} /></Field><Field label="Ends on" hint="Optional"><Input aria-label="Ends on" type="date" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></Field></div>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" /> Published answers become part of the center handbook that supports parent responses. Seasonal dates keep time-sensitive information current.</p>
            </div>
            <div className="flex items-center justify-between border-t bg-background px-6 py-4"><Button type="button" variant="ghost" onClick={closeEditor}>Cancel</Button><Button type="submit" disabled={isSaving || recommendationActionId !== null || !draft.title.trim() || !draft.answer.trim() || !draft.sourceLabel.trim()} className="gap-2">{isSaving || recommendationActionId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editingRecommendationId ? "Save edits" : isSaving ? "Saving…" : "Save to handbook"}</Button></div>
          </form>
        </section>
      </div>}
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ id, title, description, icon }: { id?: string; title: string; description?: string; icon?: React.ReactNode }) {
  return <div className="min-w-0"><h2 id={id} className="flex items-center gap-2 text-lg font-bold sm:text-xl">{icon}{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
}

function AdminNavButton({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}><span aria-hidden="true" className="size-4">{icon}</span>{label}{count !== undefined && <Badge variant="secondary" className="ml-auto">{count}</Badge>}</button>
}

function DashboardCard({ icon, title, value, description, action, onClick }: { icon: React.ReactNode; title: string; value: string; description: string; action: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Card className="h-full transition-colors hover:border-primary/40"><CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 p-3"><div className="col-start-2 row-start-1 flex items-center gap-2"><span aria-hidden="true" className="text-primary">{icon}</span><p className="text-sm font-medium text-foreground">{title}</p></div><p className="col-start-1 row-span-2 row-start-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p><p className="col-start-2 row-start-2 text-xs text-muted-foreground">{description}</p><span className="col-start-3 row-span-2 row-start-1 inline-flex items-center text-primary"><span className="sr-only">{action}</span><ChevronRight className="size-4" /></span></CardContent></Card></button>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><p className="text-sm font-medium">{label}</p>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
}

function SeasonalPanel({ suggestions, isLoading, error, onSuggest, onAdd }: { suggestions: Suggestion[]; isLoading: boolean; error: string; onSuggest: () => void; onAdd: (title: string) => void }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading title="Coming up this season" icon={<CalendarDays className="size-4 text-primary" />} />
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
