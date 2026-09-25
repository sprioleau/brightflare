import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AdminConsole from "./admin-console"

const routerMocks = vi.hoisted(() => {
  let pathname = "/admin/dashboard";
  const listeners = new Set<() => void>();
  return {
    getPathname: () => pathname,
    setPathname: (nextPathname: string) => {
      pathname = nextPathname;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    usePathname: () => React.useSyncExternalStore(routerMocks.subscribe, routerMocks.getPathname, routerMocks.getPathname),
    useRouter: () => ({
      push: (href: string) => routerMocks.setPathname(new URL(href, "http://localhost").pathname),
      replace: (href: string) => routerMocks.setPathname(new URL(href, "http://localhost").pathname),
    }),
  };
});

vi.mock("next/link", async () => {
  const React = await import("react");
  function MockLink({ href, children, onClick, ...props }: { href: string; children: React.ReactNode; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) {
    return React.createElement("a", {
      ...props,
      href,
      onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        event.preventDefault();
        routerMocks.setPathname(new URL(href, "http://localhost").pathname);
      },
    }, children);
  }
  return { default: MockLink };
});

const adminPayload = {
  center: { name: "Little Lantern Learning Center" },
  topics: [
    {
      id: "topic-closure",
      title: "Are we open on the teacher workday?",
      questionCount: 8,
      sessionCount: 6,
      status: "needs_answer",
      lastAskedAt: "2026-09-21T12:00:00.000Z",
      examples: ["Will the center be open on the teacher workday?"],
    },
  ],
  questions: [
    { id: "question-2", question: "Private child question", topicId: null, topicTitle: null, askedAt: "2026-09-23T14:00:00.000Z", outcome: "needs_staff", sourceStatus: "unsourced", isPrivate: true },
    { id: "question-1", question: "Will the center be open on the teacher workday?", topicId: "topic-closure", topicTitle: "Are we open on the teacher workday?", askedAt: "2026-09-23T13:00:00.000Z", outcome: "needs_staff", sourceStatus: "unsourced", isPrivate: false },
  ],
  questionCursor: null,
  knowledge: [],
  suggestions: [],
}

const recommendationPayload = {
  recommendations: [{
    id: "recommendation-labor-day",
    kind: "staff_answer",
    title: "Is the center open on Labor Day?",
    shortAnswer: "The holiday schedule needs confirmation.",
    answer: "Please check with the front desk about Labor Day hours.",
    sourceLabel: "Family handbook · Hours",
    category: "Schedule",
    isFeatured: true,
    rationale: "Families have asked about holiday hours and the handbook does not give a clear answer.",
    evidence: "4 families asked about holiday hours; no Labor Day schedule is published.",
    requiresStaffInput: true,
    target: "Staff answer",
    status: "pending",
  }],
}

let dashboardPayload: object = adminPayload
let recommendationsResponse: object = recommendationPayload
let authRole: "admin" | "family" | null = "admin"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("AdminConsole", () => {
  beforeEach(() => {
    routerMocks.setPathname("/admin/dashboard");
    dashboardPayload = adminPayload
    recommendationsResponse = recommendationPayload
    authRole = "admin"
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/auth") {
        return Response.json({ role: init?.method === "POST" ? "admin" : authRole })
      }
      if (String(input) === "/api/admin") {
        return Response.json(dashboardPayload)
      }
      if (String(input) === "/api/admin/recommendations" && init?.method === "POST") {
        return Response.json({ success: true })
      }
      if (String(input) === "/api/admin/recommendations") {
        return Response.json(recommendationsResponse)
      }
      if (String(input) === "/api/admin/announcement") {
        if (init?.method === "POST") return Response.json({ ok: true })
        return Response.json({ title: "", message: "", isActive: false })
      }
      if (String(input) === "/api/admin/knowledge" && init?.method === "POST") {
        return Response.json({ knowledgeId: "policy-workday" })
      }
      if (String(input) === "/api/admin/featured-order" && init?.method === "POST") {
        return Response.json(JSON.parse(String(init.body)))
      }
      return Response.json({ suggestions: [] })
    }))
  })

  it("prefills the visible demo PIN and submits it through the sign-in form", async () => {
    authRole = null
    render(<AdminConsole />)

    const pinInput = await screen.findByLabelText("Center PIN")
    expect(pinInput).toHaveValue("2468")
    expect(pinInput).toHaveAttribute("type", "text")
    expect(screen.getByText("Demo PIN: 2468. It’s intentionally visible and prefilled so reviewers can press Enter to continue.")).toBeInTheDocument()

    const signInForm = pinInput.closest("form")
    expect(signInForm).not.toBeNull()
    expect(signInForm?.querySelector('button[type="submit"]')).not.toBeNull()
    if (!signInForm) throw new Error("The staff PIN form is missing.")
    fireEvent.submit(signInForm)

    await waitFor(() => {
      const authRequest = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url) === "/api/auth" && init?.method === "POST")
      expect(authRequest).toBeDefined()
      expect(JSON.parse(String(authRequest?.[1]?.body))).toEqual({ role: "admin", pin: "2468" })
    })
  })

  it("uses individual admin links and follows browser back and forward paths", async () => {
    render(<AdminConsole />)
    await screen.findByRole("heading", { name: "Staff workspace" })
    const navigation = within(screen.getByRole("navigation", { name: "Admin navigation" }))

    expect(Array.from(navigation.getAllByRole("link")).map((link) => link.getAttribute("href"))).toEqual([
      "/admin/dashboard",
      "/admin/recommendations",
      "/admin/questions",
      "/admin/topics",
      "/admin/handbook",
      "/admin/featured",
      "/admin/announcement",
      "/admin/settings",
    ])
    fireEvent.click(navigation.getByRole("link", { name: "Handbook" }))
    expect(screen.getByRole("heading", { name: "Center handbook", level: 1 })).toBeInTheDocument()

    fireEvent.click(navigation.getByRole("link", { name: /Question topics/ }))
    expect(screen.getByLabelText("Search question topics")).toBeInTheDocument()
    expect(navigation.getByRole("link", { name: /Question topics/ })).toHaveAttribute("aria-current", "page")

    routerMocks.setPathname("/admin/handbook")
    expect(await screen.findByRole("heading", { name: "Center handbook", level: 1 })).toBeInTheDocument()
  })

  it("keeps admin workspace state while switching between individual routes", async () => {
    render(<AdminConsole />)
    await screen.findByRole("heading", { name: "Staff workspace" })
    fireEvent.click(screen.getByRole("link", { name: /Question topics/ }))
    fireEvent.change(screen.getByLabelText("Search question topics"), { target: { value: "teacher" } })
    routerMocks.setPathname("/admin/questions")
    routerMocks.setPathname("/admin/topics")

    expect(screen.getByLabelText("Search question topics")).toHaveValue("teacher")
  })

  it("links an approved handbook answer to the unanswered parent topic", async () => {
    render(<AdminConsole />)

    fireEvent.click(await screen.findByRole("link", { name: /Question topics/ }))
    await screen.findByRole("button", { name: /Are we open on the teacher workday\?/ })
    fireEvent.click(screen.getByRole("button", { name: "Write an approved answer" }))
    expect(screen.getByRole("button", { name: "Save to handbook" })).toHaveAttribute("data-variant", "default")

    fireEvent.change(screen.getByLabelText("Short answer"), { target: { value: "Yes, we are open during our usual hours." } })
    fireEvent.change(screen.getByLabelText("Full answer"), { target: { value: "The center will be open from 7:30 AM to 5:30 PM on the teacher workday." } })
    fireEvent.change(screen.getByLabelText("Citation"), { target: { value: "Center calendar · October" } })
    fireEvent.click(screen.getByRole("button", { name: "Save to handbook" }))

    await screen.findByText("Handbook answer saved and ready for parents.")
    const fetchMock = vi.mocked(fetch)
    const saveCall = fetchMock.mock.calls.find(([url, init]) => String(url) === "/api/admin/knowledge" && init?.method === "POST")
    expect(saveCall).toBeDefined()
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      topicId: "topic-closure",
      title: "Are we open on the teacher workday?",
      shortAnswer: "Yes, we are open during our usual hours.",
      sourceLabel: "Center calendar · October",
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin", { cache: "no-store" }))
  })

  it("removes a tag through a plain accessible X control", async () => {
    render(<AdminConsole />)
    await screen.findByRole("heading", { name: "Staff workspace" })
    fireEvent.click(screen.getByRole("button", { name: "Add an answer" }))
    const tagInput = screen.getByLabelText("Add tag")
    fireEvent.change(tagInput, { target: { value: "Arrival" } })
    fireEvent.keyDown(tagInput, { key: "Enter" })
    const removeButton = screen.getByRole("button", { name: "Remove Arrival tag" })

    expect(removeButton).not.toHaveClass("ui-button")
    fireEvent.click(removeButton)
    expect(screen.queryByRole("button", { name: "Remove Arrival tag" })).not.toBeInTheDocument()
  })

  it("shows individual recent questions and keeps private child wording hidden", async () => {
    dashboardPayload = {
      ...adminPayload,
      questions: [
        { id: "question-unlinked", question: "Can I bring sunscreen?", topicId: null, topicTitle: null, askedAt: "2026-09-24T14:00:00.000Z", outcome: "answered", sourceStatus: "sourced", isPrivate: false },
        ...adminPayload.questions,
      ],
    }
    render(<AdminConsole />)
    expect(await screen.findByText("Can I bring sunscreen?")).toBeInTheDocument()
    fireEvent.click(within(await screen.findByRole("navigation", { name: "Admin navigation" })).getByRole("link", { name: "Questions" }))

    expect(await screen.findByText("Will the center be open on the teacher workday?")).toBeInTheDocument()
    expect(screen.getByText("Can I bring sunscreen?")).toBeInTheDocument()
    expect(screen.getByText(/No grouped topic yet/)).toBeInTheDocument()
    expect(screen.getAllByRole("time")).toHaveLength(3)
    expect(screen.getByText("Private child question")).toBeInTheDocument()
    expect(screen.getByText(/Private family question/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Review topic" }))
    expect((await screen.findAllByRole("button", { name: "Write an approved answer" })).length).toBeGreaterThan(0)
  })

  it("loads FAQ recommendations and publishes an edited recommendation immediately", async () => {
    render(<AdminConsole />)
    fireEvent.click(within(await screen.findByRole("navigation", { name: "Admin navigation" })).getByRole("link", { name: /Recommendations/ }))

    expect(await screen.findByRole("heading", { name: "Is the center open on Labor Day?" })).toBeInTheDocument()
    expect(screen.getByText(/4 families asked about holiday hours/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    fireEvent.change(screen.getByLabelText("Short answer"), { target: { value: "We are closed on Labor Day." } })
    fireEvent.change(screen.getByLabelText("Full answer"), { target: { value: "The center is closed on Labor Day." } })
    fireEvent.change(screen.getByLabelText("Citation"), { target: { value: "Center holiday calendar" } })
    fireEvent.click(screen.getByRole("button", { name: "Save edits" }))

    expect(await screen.findByText("Recommendation changes saved. Approve when they’re ready to publish.")).toBeInTheDocument()
    const editCall = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url) === "/api/admin/recommendations" && init?.method === "POST")
    expect(editCall).toBeDefined()
    expect(JSON.parse(String(editCall?.[1]?.body))).toMatchObject({
      id: "recommendation-labor-day",
      action: "edit",
      entry: { shortAnswer: "We are closed on Labor Day.", answer: "The center is closed on Labor Day.", sourceLabel: "Center holiday calendar" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    expect(await screen.findByText("Recommended update published and live for parents.")).toBeInTheDocument()
  })

  it("filters recommendations by status and search text", async () => {
    render(<AdminConsole />)
    fireEvent.click(within(await screen.findByRole("navigation", { name: "Admin navigation" })).getByRole("link", { name: /Recommendations/ }))

    expect(await screen.findByRole("heading", { name: "Is the center open on Labor Day?" })).toBeInTheDocument()
    expect(screen.getAllByText("Needs staff").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "Ready to publish" }))
    expect(screen.getByText("No recommendations match these filters.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "All" }))
    fireEvent.change(screen.getByLabelText("Search recommendations"), { target: { value: "winter break" } })
    expect(screen.getByText("No recommendations match these filters.")).toBeInTheDocument()
  })

  it("shows a safe generation failure while keeping saved recommendations actionable", async () => {
    recommendationsResponse = {
      ...recommendationPayload,
      generationError: {
        category: "capacity",
        message: "Saved recommendations are available, but new suggestions could not be generated. Try again shortly.",
      },
    }

    render(<AdminConsole />)
    fireEvent.click(within(await screen.findByRole("navigation", { name: "Admin navigation" })).getByRole("link", { name: /Recommendations/ }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Saved recommendations are available, but new suggestions could not be generated. Try again shortly.")
    expect(screen.getByRole("heading", { name: "Is the center open on Labor Day?" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled()
  })

  it("opens Add an answer and closes the editor with its icon button", async () => {
    render(<AdminConsole />)
    fireEvent.click(await screen.findByRole("button", { name: "Add an answer" }))
    expect(screen.getByRole("dialog", { name: "Add an answer" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("FAQ title"), { target: { value: "New center answer" } })
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add an answer" }))
    expect(screen.getByLabelText("FAQ title")).toHaveValue("")
    expect(screen.getByRole("combobox", { name: "Source type" })).toHaveValue("handbook")
  })

  it("shows a streamed assistant failure beside the FAQ title action", async () => {
    const defaultFetch = vi.mocked(fetch).getMockImplementation()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/assist") {
        return new Response('{"type":"error","message":"The assistant could not prepare a suggestion. Please try again."}\n', {
          headers: { "Content-Type": "application/x-ndjson" },
        })
      }
      return defaultFetch!(input, init)
    })

    render(<AdminConsole />)
    fireEvent.click(await screen.findByRole("button", { name: "Add an answer" }))
    fireEvent.change(screen.getByLabelText("FAQ title"), { target: { value: "When should families arrive?" } })
    fireEvent.click(screen.getByRole("button", { name: "Suggest a shorter FAQ title" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("The assistant could not prepare a suggestion. Please try again.")
  })

  it("aborts a pending title suggestion when the editor closes and ignores its late response", async () => {
    const defaultFetch = vi.mocked(fetch).getMockImplementation()
    let resolveAssist: ((response: Response) => void) | undefined
    let assistSignal: AbortSignal | null | undefined
    const assistResponse = new Promise<Response>((resolve) => {
      resolveAssist = resolve
    })
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/assist") {
        assistSignal = init?.signal
        return assistResponse
      }
      return defaultFetch!(input, init)
    })

    render(<AdminConsole />)
    fireEvent.click(await screen.findByRole("button", { name: "Add an answer" }))
    fireEvent.change(screen.getByLabelText("FAQ title"), { target: { value: "A very long title to shorten" } })
    fireEvent.click(screen.getByRole("button", { name: "Suggest a shorter FAQ title" }))
    await waitFor(() => expect(assistSignal).toBeDefined())
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }))
    expect(assistSignal?.aborted).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Add an answer" }))
    resolveAssist?.(Response.json({ suggestions: ["Stale suggestion"] }))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stale suggestion" })).not.toBeInTheDocument())
    expect(screen.getByLabelText("FAQ title")).toHaveValue("")
  })

  it("searches the front desk card picker and saves the chosen card order", async () => {
    dashboardPayload = {
      ...adminPayload,
      knowledge: [
        { id: "first", title: "What are your hours?", shortAnswer: "We are open weekdays.", answer: "We are open weekdays.", sourceLabel: "Family Handbook · Hours", category: "Hours", isFeatured: true, tags: ["schedule"], featuredOrder: 0 },
        { id: "second", title: "What should my child bring?", shortAnswer: "Bring a change of clothes.", answer: "Bring a change of clothes.", sourceLabel: "Family Handbook · What to bring", category: "Daily routines", isFeatured: true, tags: ["packing"], featuredOrder: 1 },
        { id: "draft", title: "What is the late pickup fee?", shortAnswer: "Ask the office for the current fee.", answer: "Ask the office for the current fee.", sourceLabel: "Family Handbook · Hours and fees", category: "Fees", isFeatured: false, status: "draft", tags: ["billing"] },
      ],
    }
    render(<AdminConsole />)
    fireEvent.click(await screen.findByRole("link", { name: "Front desk layout" }))
    expect(screen.getByRole("heading", { name: "Family preview" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Search front desk answers"), { target: { value: "packing" } })
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Search front desk answers"), { target: { value: "billing" } })
    expect(screen.getByRole("button", { name: "Publish first" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Move What should my child bring? up" }))
    await waitFor(() => {
      const saveCall = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url) === "/api/admin/featured-order" && init?.method === "POST")
      expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({ orderedIds: ["second", "first"] })
    })
  })

  it("saves an announcement and keeps its authored text when visibility is toggled off", async () => {
    render(<AdminConsole />)
    const navigation = within(await screen.findByRole("navigation", { name: "Admin navigation" }))
    fireEvent.click(navigation.getByRole("link", { name: "Announcement" }))
    fireEvent.change(screen.getByLabelText("Announcement title"), { target: { value: "Staff learning day" } })
    fireEvent.change(screen.getByLabelText("Announcement message"), { target: { value: "We are open regular hours on October 12." } })
    fireEvent.click(screen.getByLabelText("Show announcement on front desk"))
    fireEvent.click(screen.getByRole("button", { name: "Save announcement" }))

    await waitFor(() => {
      const saveCall = vi.mocked(fetch).mock.calls.find(([url, init]) => String(url) === "/api/admin/announcement" && init?.method === "POST")
      expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({ title: "Staff learning day", message: "We are open regular hours on October 12.", isActive: true })
    })
    expect(screen.getByRole("status")).toHaveTextContent("live on the front desk")
    fireEvent.click(screen.getByLabelText("Show announcement on front desk"))
    expect(screen.getByLabelText("Announcement title")).toHaveValue("Staff learning day")
    expect(screen.getByLabelText("Announcement message")).toHaveValue("We are open regular hours on October 12.")
  })
})
