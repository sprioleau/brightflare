import { afterEach, describe, expect, it, vi } from "vitest";
import { startAskAttempt } from "./ask-diagnostics";

describe("ask diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only allowlisted classification fields and finishes an attempt once", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const controller = new AbortController();
    const diagnostic = startAskAttempt({
      requestId: "request-uuid",
      requestElapsedMs: 175,
      attempt: "primary",
      modelId: "gemini-test",
      provider: "google.generative-ai",
      budgetMs: 4_000,
      signal: controller.signal,
    });
    const secretMessage = "prompt answer source API_KEY=secret";
    diagnostic.fail(Object.assign(new Error(secretMessage), { statusCode: 429 }));
    controller.abort();

    const records = info.mock.calls.map((call) => JSON.parse(String(call[1])) as Record<string, unknown>);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ event: "attempt_start", requestId: "request-uuid", modelId: "gemini-test", provider: "google.generative-ai", budgetMs: 4_000 });
    expect(records[1]).toMatchObject({ event: "attempt_end", outcome: "capacity", statusCode: 429 });
    expect(JSON.stringify(records)).not.toContain(secretMessage);
    expect(Object.keys(records[1]).sort()).toEqual(["attempt", "budgetMs", "category", "elapsedMs", "errorClass", "event", "modelId", "outcome", "provider", "requestId", "statusCode"].sort());
  });

  it("records a hanging attempt as timeout when its budget expires", () => {
    vi.useFakeTimers();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    startAskAttempt({ requestId: "request-uuid", requestElapsedMs: 100, attempt: "fallback", modelId: "gemini-test", provider: "google.generative-ai", budgetMs: 500 });
    vi.advanceTimersByTime(500);

    const records = info.mock.calls.map((call) => JSON.parse(String(call[1])) as Record<string, unknown>);
    expect(records[1]).toMatchObject({ event: "attempt_end", attempt: "fallback", outcome: "timeout", budgetMs: 500 });
    vi.useRealTimers();
  });
});
