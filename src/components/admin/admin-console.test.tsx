import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import AdminConsole from "./admin-console"

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
  knowledge: [],
  suggestions: [],
}

describe("AdminConsole", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/auth") {
        return Response.json({ role: "admin" })
      }
      if (String(input) === "/api/admin") {
        return Response.json(adminPayload)
      }
      if (String(input) === "/api/admin/knowledge" && init?.method === "POST") {
        return Response.json({ knowledgeId: "policy-workday" })
      }
      return Response.json({ suggestions: [] })
    }))
  })

  it("links an approved handbook answer to the unanswered parent topic", async () => {
    render(<AdminConsole />)

    await screen.findByRole("button", { name: /Are we open on the teacher workday\?/ })
    fireEvent.click(screen.getByRole("button", { name: "Write an approved answer" }))

    fireEvent.change(screen.getByLabelText("Short answer"), { target: { value: "Yes, we are open during our usual hours." } })
    fireEvent.change(screen.getByLabelText("Full answer"), { target: { value: "The center will be open from 7:30 AM to 5:30 PM on the teacher workday." } })
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Center calendar · October" } })
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
})
