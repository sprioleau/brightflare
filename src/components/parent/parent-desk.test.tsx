import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

async function waitForDeskData() {
  await screen.findByRole("button", { name: /what time do you close/i });
}

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
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

  it("expands the full FAQ answer in place on mobile without sending it to chat", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const fetchMock = vi.fn(() => jsonResponse(deskResponse));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    const faq = await screen.findByRole("button", { name: /what time do you close/i });
    expect(faq).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(faq);
    expect(faq).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The center closes at 5:30 PM Monday through Friday.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the handbook section" })).toHaveAttribute("href", "/handbook/faq-hours");
    expect(screen.getByRole("heading", { name: "Popular questions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ask brightflare" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows separate FAQ previews and opens each sourced full answer", async () => {
    const fetchMock = vi.fn(() => jsonResponse(deskResponse));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);

    await waitForDeskData();
    fireEvent.click(screen.getByRole("button", { name: /what time do you close/i }));

    expect(screen.getByText("The center closes at 5:30 PM Monday through Friday.")).toBeInTheDocument();
    expect(screen.getByText("Answer source · Family Handbook · Hours")).toBeInTheDocument();
    expect(screen.getByText("Reviewed Sep 1, 2026")).toBeInTheDocument();
    expect(screen.queryByLabelText("Answer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /what should we bring/i }));
    expect(screen.getByText("Please bring a labeled water bottle and a change of clothes.")).toBeInTheDocument();
    expect(screen.getByText("Answer source · Family Handbook · Daily essentials")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Read the handbook section" }).at(-1)).toHaveAttribute("href", "/handbook/faq-bag");
    expect(screen.getAllByRole("button", { name: "Ask brightflare" })).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("submits on Shift+Enter while ordinary Enter keeps a multiline question", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => jsonResponse({ answer: "We close at 5:30 PM.", sourceLabel: "Family Handbook · Hours", sourceId: "faq-hours", reviewedAt: "2026-09-01", status: "answered" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    await waitForDeskData();
    const field = screen.getByLabelText("What can we help you find?");
    fireEvent.change(field, { target: { value: "When do you close?" } });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(await screen.findByText("We close at 5:30 PM.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Popular questions" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps completed turns visible and sends bounded prior context with a follow-up", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => jsonResponse({ answer: "We close at 5:30 PM.", sourceLabel: "Hours", sourceId: "faq-hours", reviewedAt: "2026-09-01", status: "answered" }))
      .mockImplementationOnce(() => jsonResponse({ answer: "The handbook has the current illness guidance.", sourceLabel: "Illness policy", sourceId: "faq-illness", reviewedAt: "2026-09-01", status: "answered" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    await waitForDeskData();
    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "When do you close?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    expect(await screen.findByText("We close at 5:30 PM.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "What about illness?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    expect(await screen.findByText("The handbook has the current illness guidance.")).toBeInTheDocument();
    expect(screen.getByText("When do you close?")).toBeInTheDocument();
    const secondRequest = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string) as { history: Array<{ role: string; content: string }> };
    expect(secondRequest.history).toEqual([
      { role: "user", content: "When do you close?" },
      { role: "assistant", content: "We close at 5:30 PM." },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));
    expect(screen.queryByText("When do you close?")).not.toBeInTheDocument();
    expect(screen.getByText(/Ask a new question about schedules/)).toBeInTheDocument();
  });

  it("lets a parent keep the conversation briefly, then clears the shared iPad chat", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => jsonResponse({ answer: "We close at 5:30 PM.", sourceLabel: "Hours", sourceId: "faq-hours", reviewedAt: "2026-09-01", status: "answered" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ParentDesk />);
    await waitForDeskData();

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "When do you close?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    await act(async () => Promise.resolve());
    expect(screen.getByText("We close at 5:30 PM.")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(screen.getByRole("status")).toHaveTextContent("Clear this conversation in 20 seconds");
    fireEvent.click(screen.getByRole("button", { name: "Keep reading" }));
    await act(async () => vi.advanceTimersByTimeAsync(120_000));
    expect(screen.getByRole("status")).toHaveTextContent("Clear this conversation in 20 seconds");
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    expect(screen.queryByText("When do you close?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("What can we help you find?")).toHaveValue("");
    vi.useRealTimers();
  });

  it("shows an active center announcement above the question composer", async () => {
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse({
      ...deskResponse,
      center: { ...deskResponse.center, announcement: { title: "October staff day", message: "We are open regular hours on October 12." } },
    })));

    render(<ParentDesk />);
    const announcementTitle = await screen.findByText("October staff day");
    const announcement = announcementTitle.closest(".notification-banner");
    expect(announcement).not.toBeNull();
    expect(announcement).toHaveTextContent("October staff day");
    expect(announcement).toHaveTextContent("We are open regular hours on October 12.");
    expect(screen.queryByRole("button", { name: /ask about my child/i })).not.toBeInTheDocument();
  });

  it("shows streamed answer text as a draft before revealing its final citation", async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const streamResponse = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    }), { headers: { "Content-Type": "application/x-ndjson" } });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce(() => Promise.resolve(streamResponse));
    vi.stubGlobal("fetch", fetchMock);

    render(<ParentDesk />);
    await waitForDeskData();
    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "How do I schedule a tour?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    await act(async () => {
      streamController?.enqueue(new TextEncoder().encode('{"type":"draft","value":"The office can help schedule a tour."}\n'));
    });

    expect(await screen.findByText("The office can help schedule a tour.")).toBeInTheDocument();
    expect(screen.getByText("Draft · not yet verified")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Read the handbook section" })).not.toBeInTheDocument();

    await act(async () => {
      streamController?.enqueue(new TextEncoder().encode('{"type":"final","value":{"answer":"The office can help schedule a tour.","sourceLabel":"Family Handbook · Tours","sourceId":"faq-tour","reviewedAt":"2026-09-03","status":"answered","suggestedQuestions":[]}}\n'));
      streamController?.close();
    });
    expect(await screen.findByText("Family Handbook · Tours")).toBeInTheDocument();
    expect(screen.getByText("How do I schedule a tour?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the handbook section" })).toHaveAttribute("href", "/handbook/faq-tour");
    expect(screen.queryByText("Draft · not yet verified")).not.toBeInTheDocument();
  });

  it("shows progress at 3 and 6 seconds, then times out and ignores a late response", async () => {
    let releaseLateResponse: ((response: Response) => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        requestSignal = init.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          releaseLateResponse = resolve;
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<ParentDesk />);
    await waitForDeskData();
    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "What time do you close?" } });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByRole("status")).toHaveTextContent("Still waiting for an answer…");
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByRole("status")).toHaveTextContent("Taking longer than expected…");
    await act(async () => vi.advanceTimersByTimeAsync(2_000));
    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t get an answer in time");

    const lateResponse = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"final","value":{"answer":"Late answer.","sourceLabel":"Hours","sourceId":"faq-hours","reviewedAt":"2026-09-01","status":"answered"}}\n'));
        controller.close();
      },
    }), { headers: { "Content-Type": "application/x-ndjson" } });
    await act(async () => {
      releaseLateResponse?.(lateResponse);
      await Promise.resolve();
    });
    expect(screen.queryByText("Late answer.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear chat" })).toBeEnabled();
    vi.useRealTimers();
  });

  it("resets the chat while a request is pending and ignores its late answer", async () => {
    let releaseLateResponse: ((response: Response) => void) | undefined;
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => jsonResponse(deskResponse))
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        requestSignal = init.signal as AbortSignal;
        return new Promise<Response>((resolve) => {
          releaseLateResponse = resolve;
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<ParentDesk />);
    await waitForDeskData();
    const questionInput = screen.getByLabelText("What can we help you find?");
    fireEvent.change(questionInput, { target: { value: "What time do you close?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask brightflare" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }));

    expect(requestSignal?.aborted).toBe(true);
    expect(questionInput).toHaveValue("");
    expect(screen.queryByLabelText("Answer")).not.toBeInTheDocument();
    expect(questionInput).toHaveFocus();

    const lateResponse = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"final","value":{"answer":"Late answer.","sourceLabel":"Hours","sourceId":"faq-hours","reviewedAt":"2026-09-01","status":"answered"}}\n'));
        controller.close();
      },
    }), { headers: { "Content-Type": "application/x-ndjson" } });
    await act(async () => {
      releaseLateResponse?.(lateResponse);
      await Promise.resolve();
    });
    expect(screen.queryByText("Late answer.")).not.toBeInTheDocument();
  });

  it("adds speech transcripts to the question without submitting them", async () => {
    let recognition: MockSpeechRecognition | undefined;
    class CurrentSpeechRecognition extends MockSpeechRecognition {
      constructor() {
        super();
        recognition = this;
      }
    }
    const fetchMock = vi.fn(() => jsonResponse(deskResponse));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("SpeechRecognition", CurrentSpeechRecognition);

    render(<ParentDesk />);
    await waitForDeskData();
    fireEvent.change(screen.getByLabelText("What can we help you find?"), { target: { value: "How do I" } });
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(recognition?.start).toHaveBeenCalledOnce();
    act(() => recognition?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "schedule a tour" } }],
    }));

    expect(screen.getByLabelText("What can we help you find?")).toHaveValue("How do I schedule a tour");
    expect(fetchMock).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Stop voice input" }));
    expect(recognition?.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Start voice input" })).toBeInTheDocument();
  });

  it("shows microphone denial and no-speech errors and stops recognition on unmount", async () => {
    let recognition: MockSpeechRecognition | undefined;
    class CurrentSpeechRecognition extends MockSpeechRecognition {
      constructor() {
        super();
        recognition = this;
      }
    }
    vi.stubGlobal("fetch", vi.fn(() => jsonResponse(deskResponse)));
    vi.stubGlobal("SpeechRecognition", CurrentSpeechRecognition);
    const { unmount } = render(<ParentDesk />);
    await waitForDeskData();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    act(() => recognition?.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was blocked");

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    act(() => recognition?.onerror?.({ error: "no-speech" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No speech was detected");

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    const lastRecognition = recognition;
    unmount();
    expect(lastRecognition?.stop).toHaveBeenCalledOnce();
  });
});
