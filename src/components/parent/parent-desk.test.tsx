import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ParentDesk from "./parent-desk";

const deskResponse = {
  center: { name: "Little Meadow", tagline: "Answers for your family.", hours: "Open until 5:30 PM" },
  faqs: [
    {
      id: "faq-hours",
      title: "What time do you close?",
      shortAnswer: "We're open until 5:30 PM on weekdays.",
      answer: "The center closes at 5:30 PM Monday through Friday.",
      sourceLabel: "Family Handbook · Hours",
      reviewedAt: "2026-09-01",
      category: "Hours",
    },
    {
      id: "faq-bag",
      title: "What should we bring?",
      shortAnswer: "Bring a labeled water bottle.",
      answer: "Please bring a labeled water bottle and a change of clothes.",
      sourceLabel: "Family Handbook · Daily essentials",
      reviewedAt: "2026-09-02",
      category: "Daily care",
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, json: () => Promise.resolve(body) });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parent front desk", () => {
  it("opens and closes an iPad-size desk preview", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(deskResponse)));
    render(<ParentDesk />);

    fireEvent.click(screen.getByRole("button", { name: "Preview iPad front desk" }));
    const preview = screen.getByTitle("Family help desk at iPad landscape resolution");
    expect(preview).toHaveAttribute("src", "/?ipadPreview=1");
    expect(preview).toHaveStyle({ width: "1180px", height: "820px" });
    fireEvent.click(screen.getByRole("button", { name: "Close iPad preview" }));
    expect(screen.queryByTitle("Family help desk at iPad landscape resolution")).not.toBeInTheDocument();
  });

  it("reveals short FAQ previews first on mobile, then opens the full sourced answer", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(deskResponse)));

    render(<ParentDesk />);
    const faq = await screen.findByRole("button", { name: /what time do you close/i });
    expect(faq).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(faq);
    expect(faq).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Read full answer" }));
    expect(screen.getByText("The center closes at 5:30 PM Monday through Friday.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular questions" })).toBeInTheDocument();
  });

  it("shows separate FAQ previews and opens each sourced full answer", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(deskResponse)));

    render(<ParentDesk />);

    expect(await screen.findByText("We're open until 5:30 PM on weekdays.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what time do you close/i }));

    expect(screen.getByText("The center closes at 5:30 PM Monday through Friday.")).toBeInTheDocument();
    expect(screen.getAllByText("Family Handbook · Hours")).toHaveLength(2);
    expect(screen.getByText(/Reviewed/)).toHaveTextContent("Sep 1, 2026");

    expect(screen.getByText("Bring a labeled water bottle.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what should we bring/i }));
    expect(screen.getByText("Please bring a labeled water bottle and a change of clothes.")).toBeInTheDocument();
    expect(screen.getAllByText("Family Handbook · Daily essentials")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Read the handbook section" })).toHaveAttribute("href", "/handbook/faq-bag");
  });

  it("submits on Shift+Enter while ordinary Enter keeps a multiline question", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => jsonResponse({ answer: "We close at 5:30 PM.", sourceLabel: "Family Handbook · Hours", sourceId: "faq-hours", reviewedAt: "2026-09-01", status: "answered" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    await screen.findByText("We're open until 5:30 PM on weekdays.");
    const field = screen.getByLabelText("What can we help you find?");
    fireEvent.change(field, { target: { value: "When do you close?" } });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(await screen.findByText("We close at 5:30 PM.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular questions" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("requires successful center auth before submitting a child question and does not send the child's name as question data", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => jsonResponse({ childName: "Mia Carter" }))
      .mockImplementationOnce(() => jsonResponse({
        answer: "Mia's teacher sent a note yesterday.",
        sourceLabel: "Teacher message · Sep 22",
        sourceId: "message-1",
        reviewedAt: "2026-09-22",
        status: "answered",
      }))
      .mockImplementation(() => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    await screen.findByText("We're open until 5:30 PM on weekdays.");
    fireEvent.click(screen.getByRole("button", { name: /ask about my child/i }));
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: "mia carter" } });
    fireEvent.change(screen.getByLabelText("Parent PIN"), { target: { value: "4826" } });
    fireEvent.click(screen.getByRole("button", { name: /verify access/i }));

    expect(await screen.findByText("Access verified for Mia Carter")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ role: "family", pin: "4826", childName: "mia carter" });

    fireEvent.change(screen.getByLabelText("What would you like to know?"), { target: { value: "Did she eat lunch?" } });
    fireEvent.click(screen.getByRole("button", { name: /ask privately/i }));

    expect(await screen.findByText("Mia's teacher sent a note yesterday.")).toBeInTheDocument();
    const askBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(askBody.question).toBe("@child Did she eat lunch?");
    expect(askBody.question).not.toContain("Mia Carter");
    expect(fetchMock.mock.calls[3][0]).toBe("/api/auth/logout");
  });
});
