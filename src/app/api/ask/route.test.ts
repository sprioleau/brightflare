import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  getFallbackModel: vi.fn(),
  getSession: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}));

vi.mock("ai", () => ({
  Output: { object: vi.fn((schema: unknown) => schema) },
  ToolLoopAgent: vi.fn(function MockToolLoopAgent() {
    return { generate: mocks.generate, stream: vi.fn() };
  }),
  isStepCount: vi.fn((count: number) => count),
  tool: vi.fn((definition: unknown) => definition),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    brightflare: {
      getAdmin: "getAdmin",
      getCenterVoiceSettings: "getCenterVoiceSettings",
      getChildContext: "getChildContext",
      getKnowledgeForAsk: "getKnowledgeForAsk",
      recordPrivateQuestionEvent: "recordPrivateQuestionEvent",
      recordQuestion: "recordQuestion",
    },
  },
}));

vi.mock("@/lib/ai-model", () => ({
  getGeminiModel: () => ({ modelId: "test-model" }),
  getGeminiOverloadFallbackModel: mocks.getFallbackModel,
  isGeminiOverloaded: () => false,
}));

vi.mock("@/lib/convex-server", () => ({
  getConvexServerClient: () => ({ mutation: mocks.mutation, query: mocks.query }),
  getConvexServerSecret: () => "test-secret",
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
  isSameOrigin: () => true,
}));

const sessionId = "00000000-0000-4000-8000-000000000001";
const generatedOutput = {
  sourceIds: ["hours-1"],
  needsStaff: false,
  answer: "The center is open from 7:30 AM to 5:30 PM.",
  canonicalTitle: "Center hours",
};

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

function getGeneratedPrompt(): string {
  return mocks.generate.mock.calls[0]?.[0].prompt as string;
}

describe("POST /api/ask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockReturnValue(null);
    mocks.getFallbackModel.mockReturnValue(null);
    mocks.mutation.mockResolvedValue(undefined);
    mocks.query.mockImplementation(async (functionName: string) => {
      if (functionName === "getCenterVoiceSettings") {
        return { tone: "warm", audience: "families", preferredTerms: [], forbiddenTerms: [], glossary: [] };
      }
      if (functionName === "getKnowledgeForAsk") {
        return [{ id: "hours-1", sourceLabel: "Family Handbook · Hours", reviewedAt: 1_800_000_000_000, title: "Center hours", answer: "Open Monday through Friday from 7:30 AM to 5:30 PM." }];
      }
      if (functionName === "getAdmin") return { topics: [] };
      if (functionName === "getChildContext") {
        return {
          child: { name: "Mia Carter" },
          messages: [{ id: "private-meal-1", sourceLabel: "Daily report", summary: "Mia ate lunch." }],
        };
      }
      throw new Error(`Unexpected Convex query: ${functionName}`);
    });
    mocks.generate.mockResolvedValue({ output: generatedOutput });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a legacy request without history and supplies only current approved sources", async () => {
    const response = await POST(createRequest({ question: "What are your hours?", sessionId }) as NextRequest);
    const prompt = JSON.parse(getGeneratedPrompt()) as {
      conversationHistory: unknown[];
      sources: Array<{ id: string; sourceLabel: string; text: string }>;
    };

    expect(response.status).toBe(200);
    expect(prompt.conversationHistory).toEqual([]);
    expect(prompt.sources).toEqual([{
      id: "hours-1",
      sourceLabel: "Family Handbook · Hours",
      reviewedAt: 1_800_000_000_000,
      text: "Center hours: Open Monday through Friday from 7:30 AM to 5:30 PM.",
    }]);
  });

  it("rejects more than eight history messages before reading center data", async () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index}`,
    }));
    const response = await POST(createRequest({ question: "What are your hours?", sessionId, history }) as NextRequest);

    expect(response.status).toBe(400);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("includes public follow-up history alongside the current approved sources", async () => {
    const history = [
      { role: "user", content: "What are your hours?" },
      { role: "assistant", content: "The handbook says 7:30 AM to 5:30 PM." },
    ];
    const response = await POST(createRequest({ question: "What about Friday?", sessionId, history }) as NextRequest);
    const prompt = JSON.parse(getGeneratedPrompt()) as {
      conversationHistory: Array<{ role: string; content: string }>;
      sources: Array<{ id: string }>;
    };

    expect(response.status).toBe(200);
    expect(prompt.conversationHistory).toEqual(history);
    expect(prompt.sources.map((source) => source.id)).toEqual(["hours-1"]);
  });

  it("filters private child turns out of public follow-up history", async () => {
    const history = [
      { role: "user", content: "What are your hours?" },
      { role: "assistant", content: "The handbook says 7:30 AM to 5:30 PM." },
      { role: "user", content: "@child what did my daughter eat today?" },
      { role: "assistant", content: "PRIVATE_CHILD_DETAIL_SHOULD_NOT_APPEAR" },
    ];
    const response = await POST(createRequest({ question: "Are the hours the same tomorrow?", sessionId, history }) as NextRequest);
    const prompt = JSON.parse(getGeneratedPrompt()) as {
      conversationHistory: Array<{ role: string; content: string }>;
    };

    expect(response.status).toBe(200);
    expect(prompt.conversationHistory).toEqual(history.slice(0, 2));
    expect(getGeneratedPrompt()).not.toContain("PRIVATE_CHILD_DETAIL_SHOULD_NOT_APPEAR");
  });

  it("excludes all public history when answering a verified private child question", async () => {
    mocks.getSession.mockReturnValue({ role: "family", childName: "Mia Carter" });
    const history = [
      { role: "user", content: "PUBLIC_CONTEXT_SHOULD_NOT_APPEAR" },
      { role: "assistant", content: "Prior public answer." },
    ];
    const response = await POST(createRequest({ question: "@child what did my daughter eat today?", sessionId, history }) as NextRequest);
    const prompt = getGeneratedPrompt();

    expect(response.status).toBe(200);
    expect(prompt).toContain("Mia Carter");
    expect(prompt).not.toContain("PUBLIC_CONTEXT_SHOULD_NOT_APPEAR");
    expect(mocks.query).toHaveBeenCalledWith("getChildContext", expect.objectContaining({ childName: "Mia Carter" }));
  });

  it("requires a verified family session for private child questions", async () => {
    const response = await POST(createRequest({ question: "@child what did my daughter eat today?", sessionId }) as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Enter your family PIN");
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("returns the ingress timeout while the initial center read remains pending", async () => {
    vi.useFakeTimers();
    mocks.query.mockImplementation(() => new Promise(() => undefined));
    const responsePromise = POST(createRequest({ question: "What are your hours?", sessionId }) as NextRequest);

    await vi.waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(8_000);
    const response = await responsePromise;
    const body = await response.json();

    expect(mocks.query).toHaveBeenCalledWith("getCenterVoiceSettings", expect.any(Object));
    expect(response.status).toBe(503);
    expect(body.error).toContain("couldn’t get an answer in time");
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("uses the remaining request budget after a timed out primary attempt", async () => {
    vi.useFakeTimers();
    mocks.getFallbackModel.mockReturnValue({ modelId: "fallback-model" });
    mocks.generate.mockImplementationOnce((_options: { timeout: { totalMs: number } }) => new Promise((_resolve, reject) => {
      setTimeout(() => {
        const timeoutError = new Error("Provider attempt timed out.");
        timeoutError.name = "TimeoutError";
        const wrappedError = Object.assign(new Error("Primary attempt produced no output."), { lastError: timeoutError });
        wrappedError.name = "NoOutputGeneratedError";
        reject(wrappedError);
      }, 4_000);
    }));
    mocks.generate.mockResolvedValueOnce({ output: generatedOutput });

    const responsePromise = POST(createRequest({ question: "What are your hours?", sessionId }) as NextRequest);
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    expect(mocks.generate.mock.calls[0][0].timeout.totalMs).toBe(4_000);
    await vi.advanceTimersByTimeAsync(4_000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1][0].timeout.totalMs).toBeGreaterThan(3_900);
    expect(mocks.generate.mock.calls[1][0].timeout.totalMs).toBeLessThanOrEqual(4_000);
  });

  it("returns at the original deadline when both model attempts stall", async () => {
    vi.useFakeTimers();
    mocks.getFallbackModel.mockReturnValue({ modelId: "fallback-model" });
    mocks.generate.mockImplementation((options: { timeout: { totalMs: number } }) => new Promise((_resolve, reject) => {
      setTimeout(() => {
        const timeoutError = new Error("Provider attempt timed out.");
        timeoutError.name = "TimeoutError";
        const wrappedError = Object.assign(new Error("Attempt produced no output."), { errors: [timeoutError] });
        wrappedError.name = "NoOutputGeneratedError";
        reject(wrappedError);
      }, options.timeout.totalMs);
    }));

    const responsePromise = POST(createRequest({ question: "What are your hours?", sessionId }) as NextRequest);
    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(8_000);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1][0].timeout.totalMs).toBeLessThanOrEqual(4_000);
  });

  it("lets the configured model use the full remaining budget when no fallback exists", async () => {
    vi.useFakeTimers();
    const response = await POST(createRequest({ question: "What are your hours?", sessionId }) as NextRequest);

    expect(response.status).toBe(200);
    expect(mocks.generate.mock.calls[0][0].timeout.totalMs).toBe(8_000);
  });

  it("does not start fallback after the caller aborts the request", async () => {
    mocks.getFallbackModel.mockReturnValue({ modelId: "fallback-model" });
    mocks.generate.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    const request = new Request("http://localhost/api/ask", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        host: "localhost",
        origin: "http://localhost",
      },
      body: JSON.stringify({ question: "What are your hours?", sessionId }),
      signal: controller.signal,
    });
    const responsePromise = POST(request as NextRequest);

    await vi.waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(1));
    controller.abort();
    const response = await responsePromise;

    expect(response.status).toBe(499);
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
});
