"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Logo } from "@/components/brand/Logo"
import { AppShell } from "@/components/brand/app-shell"
import { AppToast } from "@/components/ui/app-toast"
import { AdminWorkspaceNav, adminViewPaths, type AdminView } from "@/components/admin/admin-workspace-nav"
import CenterSettings from "@/components/admin/center-settings"
import { parseAnswerStream } from "@/lib/answer-stream"
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CalendarDays,
  Check,
  X,
  GripVertical,
  ClipboardCheck,
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

function statusVariant(_status: TopicStatus): "secondary" {
  return "secondary"
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

function getAdminViewFromPathname(pathname: string | null): AdminView {
  const matchingView = Object.entries(adminViewPaths).find(([, path]) => path === pathname)?.[0];
  return (matchingView as AdminView | undefined) ?? "dashboard";
}

function getAdminViewFromLegacyQuery(value: string | null): AdminView | null {
  const legacyView = value === "stream" ? "questions" : value === "inbox" ? "topics" : value;
  return legacyView === "dashboard" || legacyView === "recommendations" || legacyView === "questions" ||
    legacyView === "topics" || legacyView === "handbook" || legacyView === "featured" || legacyView === "announcement"
    ? legacyView
    : null;
}

export default function AdminConsole() {
  const pathname = usePathname()
  const router = useRouter()
  const activeView = getAdminViewFromPathname(pathname)
  const [data, setData] = useState<AdminData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
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
  const assistAbortControllerRef = useRef<AbortController | null>(null)
  const assistRequestIdRef = useRef(0)
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

  function cancelAssistantRequest() {
    assistRequestIdRef.current += 1
    assistAbortControllerRef.current?.abort()
    assistAbortControllerRef.current = null
    setAssistMode(null)
    setAssistResultMode(null)
    setAssistSuggestions([])
    setAssistError("")
  }

  const closeEditor = useCallback(function closeEditor() {
    cancelAssistantRequest()
    setIsEditing(false)
    setEditingRecommendationId(null)
    setDraft(emptyDraft)
    setSaveError("")
    setRecommendationError("")
    setTagInput("")
  }, [])

  useEffect(() => () => {
    assistRequestIdRef.current += 1
    assistAbortControllerRef.current?.abort()
  }, [])

  const prepareViewChange = useCallback(function prepareViewChange(view: AdminView) {
    closeEditor()
    shouldScrollToViewRef.current = true
    if (activeView === view) {
      requestAnimationFrame(() => {
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        shouldScrollToViewRef.current = false
      })
    }
  }, [activeView, closeEditor])

  function selectView(view: AdminView) {
    prepareViewChange(view)
    router.push(adminViewPaths[view])
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
    closeEditor()
    shouldScrollToViewRef.current = true
  }, [closeEditor, pathname])

  useEffect(() => {
    if (pathname !== "/admin") return
    const requestedView = new URLSearchParams(window.location.search).get("view")
    const legacyView = getAdminViewFromLegacyQuery(requestedView)
    if (!legacyView) return
    shouldWaitForInitialLoadRef.current = true
    router.replace(adminViewPaths[legacyView])
  }, [pathname, router])

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
    const generated = assistResultMode === "seasonal" || assistMode === "seasonal"
      ? assistSuggestions.map((title, index) => ({
        id: `assistant-${index}`,
        title,
        reason: assistMode === "seasonal" ? "Draft · checking past family questions." : "Suggested from seasonal patterns and past family questions.",
        questionCount: 0,
      }))
      : []
    return [...generated, ...(data?.suggestions ?? [])]
  }, [assistMode, assistResultMode, assistSuggestions, data?.suggestions])

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
    cancelAssistantRequest()
    setEditingRecommendationId(null)
    setDraft({ ...emptyDraft, ...prefill, tags: prefill?.tags ?? [] })
    setSaveError("")
    setAssistSuggestions([])
    setIsEditing(true)
  }

  function openEntry(entry: KnowledgeEntry) {
    cancelAssistantRequest()
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
    cancelAssistantRequest()
    const requestId = assistRequestIdRef.current
    const abortController = new AbortController()
    assistAbortControllerRef.current = abortController
    setAssistMode(mode)
    setAssistResultMode(null)
    setAssistError("")
    setAssistSuggestions([])
    const modeText = mode === "title" ? draft.title : mode === "knowledge" ? topic?.title ?? draft.title : undefined
    try {
      const response = await fetch("/api/admin/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({ mode, topicId: topic?.id, text: modeText }),
        signal: abortController.signal,
      })
      if (requestId !== assistRequestIdRef.current) return
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: unknown } | null
        throw new Error(typeof result?.error === "string" ? result.error : `The assistant could not complete this request (${response.status}).`)
      }
      let suggestions: string[] = []
      if (response.headers?.get("content-type")?.includes("application/x-ndjson") && response.body) {
        let hasFinalResult = false
        for await (const event of parseAnswerStream<string[], { suggestions: string[] }>(response.body)) {
          if (requestId !== assistRequestIdRef.current) return
          if (event.type === "draft") {
            suggestions = event.value
            setAssistSuggestions(suggestions)
          }
          if (event.type === "reset") {
            suggestions = []
            setAssistSuggestions([])
          }
          if (event.type === "final") {
            suggestions = event.value.suggestions
            hasFinalResult = true
          }
          if (event.type === "error") throw new Error(event.message)
        }
        if (!hasFinalResult) throw new Error("The assistant response ended before it was complete. Please try again.")
      } else {
        const result = (await response.json()) as { suggestions?: Array<string | { title?: string; answer?: string }> }
        if (requestId !== assistRequestIdRef.current) return
        suggestions = (result.suggestions ?? []).map((item) => typeof item === "string" ? item : item.title ?? item.answer ?? "").filter(Boolean)
      }
      if (requestId !== assistRequestIdRef.current) return
      setAssistSuggestions(suggestions)
      if (!suggestions.length) setAssistError("No suggestions came back. Try again or write the answer yourself.")
    } catch (error) {
      if (requestId !== assistRequestIdRef.current || abortController.signal.aborted) return
      setAssistSuggestions([])
      setAssistError(error instanceof Error ? error.message : "The assistant could not complete this request.")
    } finally {
      if (requestId === assistRequestIdRef.current) {
        assistAbortControllerRef.current = null
        setAssistMode(null)
        setAssistResultMode(mode)
      }
    }
  }

  function applySuggestion(suggestion: string) {
    if (assistSuggestions.includes(suggestion)) {
      setDraft((current) => ({ ...current, title: suggestion }))
    }
  }

  if (isCheckingAuth) {
    return <AppShell section="admin"><div className="flex min-h-[50vh] items-center justify-center"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" /> Checking staff access…</div></div></AppShell>
  }

  if (!isAuthenticated) {
    return <AppShell section="admin"><main className="admin-workspace flex min-h-[65vh] items-center justify-center"><Card className="w-full max-w-md"><CardHeader><div className="mb-3"><Logo size={36} /></div><CardTitle className="type-page-title">Staff access</CardTitle><CardDescription>Sign in to review family questions and keep your center’s answers current.</CardDescription></CardHeader><CardContent><form onSubmit={signIn} className="flex flex-col gap-4">{authError && <p className="type-supporting text-destructive" role="alert">{authError}</p>}<label className="flex flex-col gap-2 type-supporting font-semibold" htmlFor="admin-pin">Center PIN<Input id="admin-pin" autoComplete="current-password" inputMode="numeric" type="password" value={pin} onChange={(event) => setPin(event.target.value)} required /></label><Button className="w-full" disabled={!pin.trim()}>Continue</Button></form></CardContent></Card></main></AppShell>
  }

  return (
    <AppShell section="admin" centerName={data?.center.name}>
      <main className="admin-workspace space-y-6 [&_svg]:size-5 [&_svg]:stroke-[1.75]">
        <div className="grid items-start gap-6 min-[971px]:grid-cols-[220px_minmax(0,1fr)]">
        <AdminWorkspaceNav activeView={activeView} onNavigate={prepareViewChange} />
        <div className="min-w-0">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="type-page-title">{activeView === "settings" ? "Center settings" : activeView === "dashboard" ? "Staff workspace" : activeView === "recommendations" ? "Recommendations" : activeView === "questions" ? "Question stream" : activeView === "topics" ? "Question topics" : activeView === "featured" ? "Front desk layout" : activeView === "announcement" ? "Family announcement" : "Center handbook"}</h1>
            <p className="type-supporting mt-1 max-w-2xl">{activeView === "settings" ? "Keep the details and writing guidance behind family answers current." : activeView === "dashboard" ? "See what families need and keep center answers current." : activeView === "recommendations" ? "Review source-backed ideas before anything appears for families." : activeView === "questions" ? "Recent public questions are here; private child details stay protected." : activeView === "topics" ? "Group repeated questions so one approved answer can help more families." : activeView === "featured" ? "Choose which approved answers families see first." : activeView === "announcement" ? "Share a timely update with families from the front desk." : "Published center answers and the sources families can verify."}</p>
          </div>
          {activeView !== "settings" ? <Button type="button" onClick={() => openNewEntry()} className="gap-2"><Plus className="size-5" strokeWidth={1.75} /> Add an answer</Button> : null}
        </div>
        {loadError && <Alert variant="destructive" className="mb-5"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t load your center data</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3">{loadError}<Button variant="secondary" size="sm" onClick={() => void loadData()}>Try again</Button></AlertDescription></Alert>}

        <div>
        {activeView === "settings" ? <CenterSettings isEmbedded /> : isLoading && !data ? <Card className="flex min-h-72 items-center justify-center"><div className="flex items-center gap-3 text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading your center…</div></Card> : activeView === "dashboard" ? (
          <div className="space-y-5">
            <SectionHeading title="Your center at a glance" description="Start with items that need attention, then open the workspace you need." />
            <div className="grid gap-3 md:grid-cols-3">
              <DashboardCard icon={<ClipboardCheck className="size-4" />} title="Recommendations" value={isLoadingRecommendations ? "—" : String(recommendations.length)} description="Updates ready for your review" action="Review recommendations" onClick={() => selectView("recommendations")} />
              <DashboardCard icon={<CircleHelp className="size-4" />} title="Question topics" value={String(unansweredCount)} description="Topics without an approved answer" action="Review question topics" onClick={() => selectView("topics")} />
              <DashboardCard icon={<MessageCircle className="size-4" />} title="Family questions" value={String((data?.questions ?? []).filter((event) => Date.now() - new Date(event.askedAt).getTime() < 86_400_000).length)} description="Asked in the last 24 hours" action="Open question stream" onClick={() => selectView("questions")} />
            </div>
            <Card><CardHeader className="flex-row items-center justify-between gap-3 border-b"><SectionHeading title="Recent family questions" description="A quick pulse from the front desk." /><Button type="button" variant="secondary" size="sm" onClick={() => selectView("questions")}>View all</Button></CardHeader><div className="divide-y">{(data?.questions ?? []).slice(0, 4).map((event) => <div key={event.id} className="relative px-5 py-3 pl-7"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${event.outcome === "answered" ? "bg-emerald-500" : "bg-amber-500"}`} /><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{event.outcome === "answered" ? "Answered" : "Needs staff"}</Badge><time dateTime={event.askedAt} className="type-metadata">{formatQuestionDay(event.askedAt)} at {formatQuestionTime(event.askedAt)}</time></div><p className="type-supporting-strong mt-1">{event.isPrivate ? "A private family question was asked." : event.question}</p></div>)}{!data?.questions.length && <p className="p-6 type-supporting text-muted-foreground">Family questions will appear here as they come in.</p>}</div></Card>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => selectView("handbook")}>Open handbook</Button><Button type="button" variant="secondary" onClick={() => selectView("featured")}>Arrange front desk cards</Button><Button type="button" variant="secondary" onClick={() => selectView("announcement")}>Edit family announcement</Button></div>
          </div>
        ) : activeView === "recommendations" ? (
        <Card aria-labelledby="recommendations-heading" className="mb-6 overflow-hidden">
          <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading id="recommendations-heading" title="Recommended updates" description="Review suggested answers before they appear in your family handbook." />
            <span className="rounded-full bg-primary/10 px-2.5 py-1 type-supporting font-semibold text-primary">{recommendations.length} to review</span>
          </div>
          {recommendationError && <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 type-supporting text-destructive" role="alert">{recommendationError}<Button variant="secondary" size="sm" onClick={() => void loadRecommendations()}>Try again</Button></div>}
          {recommendations.length > 0 && <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex w-full flex-col gap-2 sm:max-w-xl sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search recommendations" placeholder="Search questions, answers, sources, and tags" value={recommendationSearch} onChange={(event) => setRecommendationSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter recommendations by tag" value={recommendationTagFilter} onChange={(event) => setRecommendationTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 type-supporting"><option value="all">All tags</option>{recommendationTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div><fieldset className="flex flex-wrap gap-2"><legend className="sr-only">Filter recommendations</legend>{(["all", "ready", "staff"] as const).map((filter) => <Button type="button" key={filter} size="sm" variant="navigation" aria-pressed={recommendationFilter === filter} onClick={() => setRecommendationFilter(filter)}>{filter === "all" ? "All" : filter === "ready" ? "Ready to publish" : "Needs staff"}</Button>)}</fieldset></div>}
          {isLoadingRecommendations && recommendations.length === 0 ? <div className="px-5 py-6 type-supporting text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Looking for useful FAQ updates…</div> : visibleRecommendations.length ? <div className="divide-y divide-border">{visibleRecommendations.map((recommendation) => <article key={recommendation.id} className="relative grid gap-4 px-5 py-4 pl-7 lg:grid-cols-[minmax(0,1fr)_auto]"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${recommendation.requiresStaffInput ? "bg-amber-500" : "bg-emerald-500"}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className={recommendation.requiresStaffInput ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>{recommendation.requiresStaffInput ? <><CircleHelp className="mr-1 size-3.5" />Needs staff</> : <><CheckCircle2 className="mr-1 size-3.5" />Ready to publish</>}</Badge><span className="type-metadata">{recommendation.category} · {recommendation.operation === "update" ? "Update existing section" : recommendation.kind === "handbook_update" ? "Handbook article" : "New FAQ"}</span></div><h3 className="type-panel-title mt-2">{recommendation.title}</h3><p className="type-supporting mt-1">{recommendation.shortAnswer}</p><p className="type-metadata mt-2 leading-relaxed">{humanizeEvidence(Array.isArray(recommendation.evidence) ? recommendation.evidence.join(" · ") : recommendation.evidence)}</p><p className="type-metadata mt-1">{recommendation.requiresStaffInput ? "Needs center details" : <>Source: {recommendation.sourceKnowledgeId ? <a href={`/handbook/${encodeURIComponent(recommendation.sourceKnowledgeId)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{recommendation.sourceLabel}</a> : recommendation.sourceLabel}</>}</p></div><div className="flex flex-wrap items-center gap-2 lg:justify-end"><Button size="sm" className="gap-1.5" disabled={recommendationActionId === recommendation.id || recommendation.requiresStaffInput} onClick={() => void updateRecommendation(recommendation.id, "approve")}><Check className="size-4" />Approve</Button><Button size="sm" variant="secondary" disabled={recommendationActionId === recommendation.id} onClick={() => { setEditingRecommendationId(recommendation.id); setDraft({ title: recommendation.title, shortAnswer: recommendation.shortAnswer, answer: recommendation.answer, sourceLabel: recommendation.sourceLabel, sourceType: recommendation.sourceType ?? "handbook", category: recommendation.category, isFeatured: recommendation.isFeatured, tags: recommendation.tags ?? [], startsAt: toDateInput(recommendation.startsAt), endsAt: toDateInput(recommendation.endsAt), topicId: recommendation.topicId }); setSaveError(""); setIsEditing(true) }}>Edit</Button><Button size="sm" variant="secondary" disabled={recommendationActionId === recommendation.id} onClick={() => void updateRecommendation(recommendation.id, "dismiss")}>Dismiss</Button></div></article>)}</div> : <p className="px-5 py-6 type-supporting text-muted-foreground">{recommendations.length ? "No recommendations match these filters." : "No updates need review right now. New suggestions will appear as families ask questions the handbook could answer better."}</p>}
        </Card>
        ) : activeView === "questions" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="min-w-0">
              <CardHeader className="border-b-2 pb-4">
                <SectionHeading title="What families are asking" description="Recent parent questions update every 15 seconds. Private child questions appear without names or message details." />
                <fieldset className="mt-4 flex flex-wrap gap-2"><legend className="sr-only">Filter family questions</legend>{(["all", "needs_staff", "answered"] as const).map((filter) => <Button type="button" key={filter} size="sm" variant="navigation" aria-pressed={questionOutcomeFilter === filter} onClick={() => setQuestionOutcomeFilter(filter)}>{filter === "all" ? "All questions" : filter === "needs_staff" ? "Needs staff" : "Answered"}</Button>)}</fieldset>
              </CardHeader>
              <div className="divide-y">
                {questionDays.length ? questionDays.map((day) => <section key={day.key} aria-label={`Family questions from ${day.label}`}>
                  <div className="flex items-center justify-between gap-3 bg-muted/50 px-5 py-2.5"><h3 className="type-supporting-strong">{day.label}</h3><span className="type-metadata">{day.events.length} {day.events.length === 1 ? "question" : "questions"}</span></div>
                  <div className="ml-5 border-l-2 border-border">
                    {day.events.map((event) => <article key={event.id} className="relative flex flex-col gap-3 border-b px-5 py-4 pl-7 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
                      <span aria-hidden="true" className={`absolute -left-[7px] top-5 size-3 rounded-full border-2 border-background ${event.outcome === "answered" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className={event.outcome === "answered" ? "bg-brand-teal text-foreground" : "bg-brand-amber text-foreground"}>{event.outcome === "answered" ? "Answered" : "Needs staff"}</Badge>
                          <time dateTime={event.askedAt} className="type-metadata">{formatQuestionTime(event.askedAt)}</time>
                        </div>
                        <p className="type-supporting-strong leading-snug">{event.isPrivate ? "Private child question" : event.question}</p>
                        <p className="type-supporting mt-1">{event.isPrivate ? "Private family question" : event.topicTitle ? `Topic: ${event.topicTitle}` : "No grouped topic yet"} · {event.sourceStatus === "sourced" ? "Sourced answer" : "No verified source"}</p>
                      </div>
                      {event.topicId ? <Button type="button" variant="secondary" size="sm" className="shrink-0 self-start" onClick={() => { setSelectedTopicId(event.topicId); selectView("topics") }}>Review topic<ChevronRight data-icon="inline-end" /></Button> : null}
                    </article>)}
                  </div>
                </section>) : <div className="p-8 text-center type-supporting text-muted-foreground">{(data?.questions ?? []).length ? "No questions match this filter." : "New parent questions will appear here as they are asked."}</div>}
              </div>
              {data?.questionCursor ? <div className="flex flex-col items-center gap-2 border-t px-5 py-4"><Button type="button" variant="secondary" onClick={() => void loadOlderQuestions()} disabled={isLoadingOlderQuestions}>{isLoadingOlderQuestions ? "Loading earlier questions…" : "Load earlier questions"}</Button>{olderQuestionsError ? <p role="alert" className="type-supporting text-destructive">{olderQuestionsError}</p> : null}</div> : null}
            </Card>
            <Card className="self-start bg-accent">
              <CardHeader><SectionHeading title="Turn demand into answers" description="Questions with no verified source become topics for your team to review." /></CardHeader>
              <CardContent className="space-y-3"><p className="type-supporting">{unansweredCount} topics need an approved answer. Similar questions are grouped so one handbook update can help many families.</p><Button variant="secondary" className="w-full bg-card" onClick={() => selectView("topics")}>Review topics<ArrowUpRight data-icon="inline-end" /></Button></CardContent>
            </Card>
          </div>
        ) : activeView === "topics" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.88fr)]">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading title="Questions families are asking" description="Similar questions are grouped into topics. Counts use anonymous sessions." />
                  <Badge variant="secondary">{unansweredCount} need attention</Badge>
                </div>
                <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search question topics" placeholder="Search topics or parent wording" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" /></div>
              </CardHeader>
              <div className="space-y-4 p-4">
                {topicGroups.length ? topicGroups.map(([category, topics]) => <section key={category} aria-label={`${category} category`} className="space-y-2">
                  <h3 className="type-subheading flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">{category}{topics.some((topic) => topic.isCategorySuggested) && <span className="type-metadata">Suggested</span>}</h3>
                  <div className="flex flex-col gap-2">
                  {topics.map((topic) => <Button variant="disclosure" type="button" aria-pressed={selectedTopic?.id === topic.id} key={topic.id} onClick={() => { setSelectedTopicId(topic.id); setAssistSuggestions([]); setAssistError("") }} className="relative !h-auto w-full justify-start overflow-hidden whitespace-normal rounded-xl border px-4 py-4 pl-7 text-left text-foreground"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${topic.status === "needs_answer" ? "bg-amber-500" : topic.status === "needs_review" ? "bg-blue-500" : "bg-emerald-500"}`} />
                    <span className="flex w-full items-start justify-between gap-3">
                      <span className="min-w-0"><span className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={statusVariant(topic.status)}>{statusLabel(topic.status)}</Badge><span className="type-metadata">{formatRelativeTime(topic.lastAskedAt)}</span></span><span className="block font-semibold leading-snug">{topic.title}</span><span className="mt-1 block line-clamp-1 type-supporting font-normal text-muted-foreground">“{topic.examples[0] ?? "Parent question"}”</span></span>
                      <span className="shrink-0 text-right"><span className="block type-panel-title tabular-nums">{topic.questionCount}</span><span className="block type-metadata font-normal text-muted-foreground">questions</span><span className="mt-1 block type-metadata font-normal text-muted-foreground">{topic.sessionCount} sessions</span></span>
                    </span>
                  </Button>)}
                  </div>
                </section>) : <div className="p-10 text-center type-supporting text-muted-foreground">No question topics match that search.</div>}
              </div>
            </Card>

            <div className="space-y-5">
              <Card>
                {selectedTopic ? <>
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between gap-3"><Badge variant={statusVariant(selectedTopic.status)}>{statusLabel(selectedTopic.status)}</Badge><span className="type-metadata">Last asked {formatRelativeTime(selectedTopic.lastAskedAt).toLowerCase()}</span></div>
                    <CardTitle className="type-panel-title">{selectedTopic.title}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 pt-1"><span>{selectedTopic.questionCount} questions</span><span>·</span><span>{selectedTopic.sessionCount} anonymous sessions</span></CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div><h3 className="type-subheading mb-2">How families ask</h3><div className="flex flex-col gap-2">{selectedTopic.examples.slice(0, 3).map((example, index) => <p key={`${example}-${index}`} className="border px-3 py-2 type-supporting text-muted-foreground">“{example}”</p>)}</div><p className="type-metadata mt-2">Names and child details are removed from this view.</p></div>
                    <div className="border p-4"><div className="mb-2 flex items-center gap-2 type-supporting font-semibold"><WandSparkles className="size-4 text-primary" /> Admin assistant</div><p className="type-supporting">Use center history to draft a response or shape this into a short front desk FAQ. You approve every change.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Button variant="secondary" size="sm" className="justify-start gap-2" disabled={assistMode !== null} onClick={() => void askAssistant("knowledge", selectedTopic)}>{assistMode === "knowledge" ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <WandSparkles data-icon="inline-start" />} Draft an answer</Button><Button variant="secondary" size="sm" className="justify-start gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}><Plus data-icon="inline-start" /> Add to handbook</Button></div></div>
                    {assistError && <p className="type-supporting text-destructive" role="alert">{assistError}</p>}
                    {(assistResultMode === "knowledge" || assistMode === "knowledge") && assistSuggestions.length > 0 && <div aria-live="polite" className="border bg-card p-3"><div className="mb-2 flex items-center justify-between type-metadata font-semibold"><span>{assistMode === "knowledge" ? "Draft suggestion · checking center evidence" : "Assistant suggestion"}</span><Button size="sm" variant="secondary" disabled={assistMode === "knowledge"} onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, answer: assistSuggestions[0], category: "Family questions" })}>Review & edit <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button></div><p className="line-clamp-4 type-supporting text-muted-foreground">{assistSuggestions[0]}</p></div>}
                    {selectedTopic.status === "needs_answer" && <Button className="w-full gap-2" onClick={() => openNewEntry({ topicId: selectedTopic.id, title: selectedTopic.title, category: "Family questions" })}>Write an approved answer <ChevronRight className="h-4 w-4" /></Button>}
                  </CardContent>
                </> : <div className="p-12 text-center type-supporting text-muted-foreground">No topics yet. Parent questions will appear here as they come in.</div>}
              </Card>
              <SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} />
            </div>
          </div>
        ) : activeView === "featured" ? (
          <div className="space-y-5">
            <SectionHeading title="Front desk layout" description="Preview and arrange the featured FAQ cards families see first." />
            {featuredOrderError && <Alert variant="destructive"><CircleHelp className="size-4" /><AlertDescription>{featuredOrderError}</AlertDescription></Alert>}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <Card>
                <CardHeader className="border-b"><SectionHeading title="Family preview" description="Cards appear in this order on the parent front desk." /></CardHeader>
                <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
                  {featuredEntries.map((entry, index) => <article key={entry.id} draggable onDragStart={() => setDraggedFeaturedId(entry.id)} onDragEnd={() => setDraggedFeaturedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!draggedFeaturedId || draggedFeaturedId === entry.id) return; const next = [...featuredOrder]; const from = next.indexOf(draggedFeaturedId); const to = next.indexOf(entry.id); next.splice(from, 1); next.splice(to, 0, draggedFeaturedId); setDraggedFeaturedId(null); void persistFeaturedOrder(next) }} className="relative flex min-h-36 cursor-grab flex-col overflow-hidden rounded-md border bg-card p-4 pl-5 active:cursor-grabbing">
                    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${["bg-primary", "bg-teal-500", "bg-pink-500", "bg-amber-500"][index % 4]}`} />
                    <div className="flex items-start justify-between gap-3"><div><Badge variant="secondary" className="mb-2 type-metadata">{entry.category}</Badge><h3 className="type-panel-title">{entry.title}</h3></div><GripVertical aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" /></div><p className="type-supporting mt-2 line-clamp-3">{entry.shortAnswer}</p>
                    <div className="mt-auto flex items-center justify-between pt-4"><span className="type-metadata">Card {index + 1}</span><div className="flex gap-1"><Button type="button" size="icon" variant="icon" aria-label={`Move ${entry.title} up`} disabled={index === 0 || isSavingFeaturedOrder} onClick={() => moveFeatured(entry.id, -1)}><ChevronRight className="size-4 -rotate-90" /></Button><Button type="button" size="icon" variant="icon" aria-label={`Move ${entry.title} down`} disabled={index === featuredEntries.length - 1 || isSavingFeaturedOrder} onClick={() => moveFeatured(entry.id, 1)}><ChevronRight className="size-4 rotate-90" /></Button><Button type="button" size="icon" variant="icon" aria-label={`Remove ${entry.title} from front desk`} disabled={isSavingFeaturedOrder} onClick={() => void setFeatured(entry, false)}><X className="size-4" /></Button></div></div>
                  </article>)}
                  {!featuredEntries.length && <p className="col-span-full rounded-lg border border-dashed p-8 text-center type-supporting text-muted-foreground">No featured answers yet. Add a handbook answer below to build the family view.</p>}
                  {isSavingFeaturedOrder && <output className="col-span-full type-metadata text-muted-foreground">Saving front desk order…</output>}
                </CardContent>
              </Card>
              <Card><CardHeader className="border-b"><SectionHeading title="Handbook answers" description="Search approved answers, then add or remove cards from the front desk." /><div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search front desk answers" placeholder="Search answers, sources, or tags" value={featuredSearch} onChange={(event) => setFeaturedSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter front desk answers by tag" value={featuredTagFilter} onChange={(event) => setFeaturedTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 type-supporting"><option value="all">All tags</option>{handbookTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div></CardHeader><div className="divide-y">{availableFeaturedEntries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate type-supporting font-semibold">{entry.title}</p><p className="mt-0.5 truncate type-metadata text-muted-foreground">{entry.category} · {entry.sourceLabel}</p></div><Button type="button" size="sm" variant="secondary" disabled={isSavingFeaturedOrder || entry.status === "draft" || (!entry.isFeatured && featuredEntries.length >= 8)} onClick={() => void setFeatured(entry, !entry.isFeatured)}>{entry.status === "draft" ? "Publish first" : entry.isFeatured ? "Remove" : "Add"}</Button></div>)}{!availableFeaturedEntries.length && <p className="p-6 type-supporting text-muted-foreground">{data?.knowledge.length ? "No handbook answers match this search." : "Add approved answers to the handbook first."}</p>}</div></Card>
            </div>
          </div>
        ) : activeView === "handbook" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader className="border-b pb-4"><div className="flex items-center justify-between gap-4"><SectionHeading title="Center handbook" description="Approved answers, sourced to your center’s policies and updates." /><Button size="sm" variant="secondary" onClick={() => openNewEntry()}><Plus className="mr-1 h-4 w-4" /> Add answer</Button></div><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search handbook" placeholder="Search answers, sources, and tags" value={handbookSearch} onChange={(event) => setHandbookSearch(event.target.value)} className="pl-9" /></div><select aria-label="Filter handbook by tag" value={handbookTagFilter} onChange={(event) => setHandbookTagFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 type-supporting"><option value="all">All tags</option>{handbookTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></div></CardHeader>
              <div className="divide-y">{visibleHandbook.map((entry) => <Button type="button" key={entry.id} variant="disclosure" onClick={() => openEntry(entry)} className="relative !h-auto w-full justify-start whitespace-normal rounded-none border-x-0 border-t-0 px-5 py-4 pl-7 text-left text-foreground last:border-b-0"><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${entry.isFeatured ? "bg-primary" : "bg-border"}`} /><span className="min-w-0 flex-1"><span className="block font-semibold">{entry.title}</span><span className="type-supporting mt-1 block line-clamp-2">{entry.shortAnswer}</span><span className="type-metadata mt-2 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5"><FileText className="size-5" />{entry.sourceLabel}</span>{entry.isFeatured && <Badge variant="secondary" >Shown on front desk</Badge>}{(entry.tags ?? []).map((tag) => <Badge key={tag} variant="secondary" >{tag}</Badge>)}</span></span><ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" /></Button>)}{!visibleHandbook.length && <div className="p-10 text-center type-supporting text-muted-foreground">{data?.knowledge.length ? "No handbook answers match these filters." : "Your handbook is ready for its first approved answer."}</div>}</div>
            </Card>
            <div className="space-y-5"><SeasonalPanel suggestions={seasonalIdeas} isLoading={assistMode === "seasonal"} error={assistResultMode === "seasonal" ? assistError : ""} onSuggest={() => void askAssistant("seasonal")} onAdd={(title) => openNewEntry({ title, category: "Seasonal" })} /><Card><CardHeader><SectionHeading title="Keep answers current" icon={<Lightbulb className="size-4 text-primary" />} description="Seasonal answers show only during the dates you choose." /></CardHeader><CardContent><p className="type-supporting">Use effective dates for holidays, weather closures, and school calendar changes. The front desk can show the short answer while parents can open the full policy and source.</p></CardContent></Card></div>
          </div>
        ) : activeView === "announcement" ? (
          <Card className="max-w-3xl"><CardHeader className="border-b"><SectionHeading title="Family announcement" description="Write a short update for families and choose whether it appears on the front desk." /></CardHeader><CardContent className="pt-5"><form onSubmit={saveAnnouncement} onChange={() => { hasEditedAnnouncementRef.current = true }} className="space-y-5">{announcementError && <p role="alert" className="type-supporting text-destructive">{announcementError}</p>}<Field label="Announcement title"><Input aria-label="Announcement title" required maxLength={80} value={announcement.title} onChange={(event) => setAnnouncement((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Friday pickup reminder" /></Field><Field label="Message"><Textarea aria-label="Announcement message" required rows={5} maxLength={500} value={announcement.message} onChange={(event) => setAnnouncement((current) => ({ ...current, message: event.target.value }))} placeholder="Share the key details families should know." /><p className="type-metadata text-right">{announcement.message.length}/500</p></Field><div className="rounded-lg border p-4"><label className="flex cursor-pointer items-start gap-3"><input aria-label="Show announcement on front desk" type="checkbox" checked={announcement.isActive} onChange={(event) => setAnnouncement((current) => ({ ...current, isActive: event.target.checked }))} className="mt-1 size-4 accent-primary" /><span><span className="block type-supporting font-semibold">Show announcement on the front desk</span><span className="type-metadata mt-0.5 block">Turn this off to keep the saved announcement here without displaying it to families.</span></span></label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="type-supporting">Current status: <Badge variant="secondary">{announcement.isActive ? "Visible to families" : "Saved, inactive"}</Badge></p><Button type="submit" disabled={isSavingAnnouncement || !announcement.title.trim() || !announcement.message.trim()}>{isSavingAnnouncement ? <LoaderCircle className="size-4 animate-spin" data-icon="inline-start" /> : <Check data-icon="inline-start" />}{isSavingAnnouncement ? "Saving…" : "Save announcement"}</Button></div></form></CardContent></Card>
        ) : (
          <p className="type-supporting">Choose a workspace section from the navigation.</p>
        )}
        </div>
        </div>
        </div>



      </main>

      {toast && <AppToast message={toast} onDismiss={() => setToast("")} />}

      {isEditing && <div className="fixed inset-0 z-40 flex justify-end bg-foreground/20">
        <div aria-hidden="true" className="absolute inset-0 cursor-default" onMouseDown={closeEditor} />
        <section role="dialog" aria-modal="true" aria-labelledby="editor-heading" className="relative z-10 flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden border-l bg-background shadow-[-12px_0_32px_rgb(32_54_76/0.08)]">
          <div className="flex items-start justify-between border-b px-6 py-5"><div><h2 id="editor-heading" className="type-panel-title">{editingRecommendationId ? "Edit recommended content" : draft.id ? "Edit answer" : "Add an answer"}</h2><p className="type-supporting mt-1">{editingRecommendationId ? "Save your edits to the recommendation, then approve it to publish." : "Everything here is reviewed by your team before families see it."}</p></div><Button type="button" variant="icon" size="icon" aria-label="Close editor" onClick={closeEditor}><X className="size-4" /></Button></div>
          <form onSubmit={saveKnowledge} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {saveError && <Alert variant="destructive"><CircleHelp className="h-4 w-4" /><AlertTitle>Couldn’t save this answer</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert>}
              {editingRecommendationId && recommendationError && <p role="alert" className="type-supporting text-destructive">{recommendationError}</p>}
              <Field label="FAQ title" hint="Keep it short so it fits on the front desk screen."><div className="flex gap-2"><Input aria-label="FAQ title" required maxLength={65} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Are we open on the teacher workday?" /><Button type="button" variant="icon" size="icon" aria-label="Suggest a shorter FAQ title" title="Suggest a shorter title" disabled={!draft.title || assistMode === "title"} onClick={() => void askAssistant("title")}><WandSparkles className="h-4 w-4" /></Button></div><div className="mt-1 flex justify-between type-metadata text-muted-foreground"><span>{assistMode === "title" ? "Finding a shorter title…" : "Families see this question first."}</span><span>{draft.title.length}/65</span></div>{assistError && assistResultMode === "title" ? <p role="alert" className="mt-2 type-supporting text-destructive">{assistError}</p> : null}{assistSuggestions.length > 0 && <div aria-live="polite" className="mt-2 flex flex-wrap gap-2">{assistMode === "title" ? <span className="w-full type-metadata text-muted-foreground">Draft suggestions · checking the handbook</span> : null}{assistSuggestions.map((suggestion) => <Button key={suggestion} type="button" size="sm" variant="secondary" disabled={assistMode === "title"} onClick={() => applySuggestion(suggestion)}>{suggestion}</Button>)}</div>}</Field>
              <Field label="Short answer" hint="One sentence for the front desk card."><Textarea aria-label="Short answer" required rows={2} maxLength={180} value={draft.shortAnswer} onChange={(event) => setDraft((current) => ({ ...current, shortAnswer: event.target.value }))} placeholder="A clear, direct answer in plain language." /><div className="mt-1 text-right type-metadata text-muted-foreground">{draft.shortAnswer.length}/180</div></Field>
              <Field label="Full answer"><Textarea aria-label="Full answer" required rows={5} value={draft.answer} onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))} placeholder="Include the details families need and any next step." /></Field>
              <Field label="Source type"><select aria-label="Source type" value={draft.sourceType} onChange={(event) => setDraft((current) => ({ ...current, sourceType: event.target.value as KnowledgeDraft["sourceType"] }))} className="h-10 w-full rounded-md border bg-background px-3 type-supporting"><option value="handbook">Family handbook</option><option value="center_update">Center update</option><option value="staff_policy">Staff policy</option><option value="other_approved_source">Other approved source</option></select></Field>
              <Field label="Citation" hint="Name the specific policy, section, or page families can verify against."><div><Input aria-label="Citation" list="admin-source-labels" required value={draft.sourceLabel} onChange={(event) => setDraft((current) => ({ ...current, sourceLabel: event.target.value }))} placeholder="e.g. Family Handbook · Hours & closures" /><datalist id="admin-source-labels">{sourceOptions.map((source) => <option key={source} value={source} />)}</datalist></div></Field>
              <Field label="Category"><Input aria-label="Category" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="General, meals, schedule…" /></Field>
              <Field label="Tags" hint="Add a few searchable topics, such as meals, billing, or arrival."><div className="flex gap-2"><Input aria-label="Add tag" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraftTag() } }} placeholder="Add a tag" /><Button type="button" variant="secondary" onClick={addDraftTag}>Add tag</Button></div><div className="mt-2 flex flex-wrap gap-2">{draft.tags.map((tag) => <Badge key={tag} variant="secondary" className="gap-1">{tag}<button type="button" aria-label={`Remove ${tag} tag`} className="ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))}><X aria-hidden="true" className="size-5" strokeWidth={1.75} /></button></Badge>)}</div></Field>
              <div className="border p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => setDraft((current) => ({ ...current, isFeatured: event.target.checked }))} className="mt-1 h-4 w-4 accent-primary" /><span><span className="block type-supporting font-semibold">Show on front desk</span><span className="type-metadata mt-0.5 block">Feature this answer as a visible FAQ card for parents.</span></span></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts on" hint="Optional"><Input aria-label="Starts on" type="date" value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} /></Field><Field label="Ends on" hint="Optional"><Input aria-label="Ends on" type="date" value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></Field></div>
              <p className="flex items-start gap-2 type-metadata leading-relaxed text-muted-foreground"><BookOpen className="mt-0.5 h-4 w-4 shrink-0" /> Published answers become part of the center handbook that supports parent responses. Seasonal dates keep time-sensitive information current.</p>
            </div>
            <div className="flex items-center justify-between border-t bg-background px-6 py-4"><Button type="button" variant="secondary" onClick={closeEditor}>Cancel</Button><Button type="submit" disabled={isSaving || recommendationActionId !== null || !draft.title.trim() || !draft.answer.trim() || !draft.sourceLabel.trim()} className="gap-2">{isSaving || recommendationActionId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{editingRecommendationId ? "Save edits" : isSaving ? "Saving…" : "Save to handbook"}</Button></div>
          </form>
        </section>
      </div>}
    </AppShell>
  )
}

function SectionHeading({ id, title, description, icon }: { id?: string; title: string; description?: string; icon?: React.ReactNode }) {
  return <div className="min-w-0"><h2 id={id} className="type-section-title flex items-center gap-2">{icon}{title}</h2>{description && <p className="type-supporting mt-1">{description}</p>}</div>
}

function DashboardCard({ icon, title, value, description, action, onClick }: { icon: React.ReactNode; title: string; value: string; description: string; action: string; onClick: () => void }) {
  return <Button type="button" variant="disclosure" onClick={onClick} className="!h-auto min-h-28 w-full justify-start whitespace-normal rounded-xl p-4 text-left"><span className="flex w-full items-start justify-between gap-3"><span className="min-w-0"><span className="type-supporting-strong flex items-center gap-2"><span aria-hidden="true" className="text-muted-foreground">{icon}</span>{title}</span><span className="mt-2 block type-section-title tabular-nums text-foreground">{value}</span><span className="type-supporting mt-1 block">{description}</span><span className="type-supporting-strong mt-3 block text-primary">{action}</span></span><ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} /></span></Button>
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><p className="type-supporting-strong">{label}</p>{children}{hint && <p className="type-metadata">{hint}</p>}</div>
}

function SeasonalPanel({ suggestions, isLoading, error, onSuggest, onAdd }: { suggestions: Suggestion[]; isLoading: boolean; error: string; onSuggest: () => void; onAdd: (title: string) => void }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <SectionHeading title="Coming up this season" icon={<CalendarDays className="size-4 text-primary" />} />
          <Button size="icon" variant="icon" aria-label="Refresh seasonal suggestions" onClick={onSuggest} disabled={isLoading}>{isLoading ? <LoaderCircle className="animate-spin" /> : <ArrowUpRight />}</Button>
        </div>
        <CardDescription>Ideas based on the time of year and past family questions.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-4">
        {suggestions.slice(0, 3).map((suggestion) => <div key={suggestion.id} className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="type-supporting-strong leading-snug">{suggestion.title}</p><p className="type-metadata mt-1 leading-relaxed">{suggestion.reason}{suggestion.questionCount > 0 && ` · ${suggestion.questionCount} past questions`}</p></div><Button size="sm" variant="secondary" className="shrink-0" onClick={() => onAdd(suggestion.title)}>Review</Button></div>)}
        {error && <p className="type-supporting text-destructive" role="alert">{error}</p>}
        {suggestions.length === 0 && !isLoading && <p className="py-1 type-supporting text-muted-foreground">Ask the assistant to look at historical questions for timely topics.</p>}
        <Button variant="secondary" size="sm" onClick={onSuggest} disabled={isLoading} className="mt-1 w-full gap-2">{isLoading ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Clock3 data-icon="inline-start" />}{isLoading ? "Looking through past questions…" : "Find seasonal ideas"}</Button>
      </CardContent>
    </Card>
  )
}
