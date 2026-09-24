import { describe, expect, it, vi } from "vitest";
import { createAnswerStreamResponse, createRequestDeadline, parseAnswerStream } from "./answer-stream";

type Output = { answer: string; sourceIds: string[]; needsStaff: boolean };
type Final = { answer: string; status: "answered" | "handoff" };

function createAttempt(partialOutputStream: AsyncIterable<unknown>, output: PromiseLike<Output>) {
  return { partialOutputStream, output };
}

describe("answer streaming", () => {
  it("returns a preflight timeout before response headers when a backend read never settles", async () => {
    vi.useFakeTimers();
    const requestController = new AbortController();
    const deadline = createRequestDeadline(requestController.signal, 8_000);
    const preflight = new Promise<Response>(() => undefined);
    const result = Promise.race([
      preflight.then((response) => ({ type: "response" as const, response })),
      deadline.outcome.then((outcome) => ({ type: outcome })),
    ]);

    await vi.advanceTimersByTimeAsync(7_999);
    expect(deadline.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ type: "timeout" });
    expect(deadline.signal.aborted).toBe(true);
    deadline.clear();
    vi.useRealTimers();
  });

  it("clears the ingress timer when the client cancels before headers", async () => {
    vi.useFakeTimers();
    const requestController = new AbortController();
    const deadline = createRequestDeadline(requestController.signal, 8_000);
    requestController.abort();

    await expect(deadline.outcome).resolves.toBe("cancelled");
    deadline.clear();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("emits a verified-source draft before the final answer is ready", async () => {
    let releasePartialStream: (() => void) | undefined;
    let resolveFirstDraft: (() => void) | undefined;
    const firstDraftReady = new Promise<void>((resolve) => {
      resolveFirstDraft = resolve;
    });
    const finishPartialStream = new Promise<void>((resolve) => {
      releasePartialStream = resolve;
    });

    async function* partials() {
      yield { answer: "The center opens at 7:30 AM.", sourceIds: ["hours"], needsStaff: false };
      resolveFirstDraft?.();
      await finishPartialStream;
    }

    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt(partials(), Promise.resolve({ answer: "The center opens at 7:30 AM.", sourceIds: ["hours"], needsStaff: false })),
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
    });

    const iterator = parseAnswerStream<string, Final>(response.body!)[Symbol.asyncIterator]();
    const firstEvent = iterator.next();
    await firstDraftReady;
    await expect(firstEvent).resolves.toEqual({
      done: false,
      value: { type: "draft", value: "The center opens at 7:30 AM." },
    });
    releasePartialStream?.();
    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { type: "final", value: { answer: "The center opens at 7:30 AM.", status: "answered" } },
    });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
  });

  it("clears a draft and returns a safe error when later fields invalidate the stream", async () => {
    async function* partials() {
      yield { answer: "The center opens at 7:30 AM.", sourceIds: ["hours"], needsStaff: false };
      yield { answer: "The center opens at 7:30 AM.", sourceIds: ["unknown"], needsStaff: false };
      throw new Error("provider stream failed");
    }

    const onFailure = vi.fn(async () => undefined);
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt(partials(), Promise.reject(new Error("provider stream failed"))),
      getDraftValue: (partial) => {
        const candidate = partial as { answer?: string; sourceIds?: string[] };
        return candidate.sourceIds?.every((sourceId) => sourceId === "hours") ? candidate.answer ?? null : null;
      },
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure,
      errorMessage: "Please ask the front desk team.",
    });

    const events = [];
    for await (const event of parseAnswerStream<string, Final>(response.body!)) events.push(event);
    expect(events.map((event) => event.type)).toEqual(["draft", "reset", "error"]);
    expect(events.at(-1)).toMatchObject({ type: "error", message: "Please ask the front desk team.", aiError: { category: "unknown" } });
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("resets a primary model draft before streaming the fallback answer", async () => {
    async function* primaryPartials() {
      yield { answer: "A provisional answer.", sourceIds: ["hours"], needsStaff: false };
      const timeoutError = new Error("Primary model timed out.");
      timeoutError.name = "TimeoutError";
      throw Object.assign(new Error("Primary produced no output."), { lastError: timeoutError });
    }
    async function* fallbackPartials() {
      yield { answer: "The verified answer.", sourceIds: ["hours"], needsStaff: false };
    }
    const createFallbackAttempt = vi.fn(() => createAttempt(
      fallbackPartials(),
      Promise.resolve({ answer: "The verified answer.", sourceIds: ["hours"], needsStaff: false }),
    ));
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt(
        primaryPartials(),
        Promise.reject(new Error("Primary model timed out.")),
      ),
      createFallbackAttempt,
      shouldFallback: (error) => error instanceof Error,
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
    });

    const events = [];
    for await (const event of parseAnswerStream<string, Final>(response.body!)) events.push(event);

    expect(events.map((event) => event.type)).toEqual(["draft", "reset", "draft", "final"]);
    expect(events[2]).toEqual({ type: "draft", value: "The verified answer." });
    expect(createFallbackAttempt).toHaveBeenCalledOnce();
  });

  it("uses the original provider error when the SDK output promise wraps it", async () => {
    const originalError = { name: "StreamProviderError", statusCode: 503, code: "UNAVAILABLE", message: "This model is currently experiencing high demand. Please try again later." };
    const wrappedError = Object.assign(new Error("No output was generated."), { name: "NoOutputGeneratedError" });
    async function* failedPartials() { throw wrappedError; }
    async function* fallbackPartials() { yield { answer: "The verified answer.", sourceIds: ["hours"], needsStaff: false }; }
    const fallback = vi.fn(() => createAttempt(fallbackPartials(), Promise.resolve({ answer: "The verified answer.", sourceIds: ["hours"], needsStaff: false })));
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => ({ ...createAttempt(failedPartials(), Promise.reject(wrappedError)), getOriginalError: () => originalError }),
      createFallbackAttempt: fallback,
      shouldFallback: (error) => (error as { statusCode?: number }).statusCode === 503,
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
    });

    const events = [];
    for await (const event of parseAnswerStream<string, Final>(response.body!)) events.push(event);
    expect(events.at(-1)).toEqual({ type: "final", value: { answer: "The verified answer.", status: "answered" } });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("resets and errors by the deadline even when the iterator ignores abort and failure logging stalls", async () => {
    let releasePartialStream: (() => void) | undefined;
    const finishPartialStream = new Promise<void>((resolve) => {
      releasePartialStream = resolve;
    });
    async function* partials() {
      yield { answer: "A provisional answer.", sourceIds: ["hours"], needsStaff: false };
      await finishPartialStream;
      yield { answer: "A late answer.", sourceIds: ["hours"], needsStaff: false };
    }

    const resolveFinal = vi.fn(async (output: Output) => ({ answer: output.answer, status: "answered" as const }));
    const onFailure = vi.fn(() => new Promise<void>(() => undefined));
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt(partials(), new Promise<Output>(() => undefined)),
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal,
      onFailure,
      errorMessage: "Unable to answer.",
      timeoutMs: 5,
    });

    const events = [];
    for await (const event of parseAnswerStream<string, Final>(response.body!)) events.push(event);
    expect(events.map((event) => event.type)).toEqual(["draft", "reset", "error"]);
    expect(events.at(-1)).toMatchObject({
      type: "error",
      message: "This is taking longer than expected. Please try again or ask the front desk team.",
      aiError: { category: "timeout" },
    });
    releasePartialStream?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events.map((event) => event.type)).toEqual(["draft", "reset", "error"]);
    expect(resolveFinal).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("does not emit a timeout error after the client cancels the response", async () => {
    let releasePartialStream: (() => void) | undefined;
    const finishPartialStream = new Promise<void>((resolve) => {
      releasePartialStream = resolve;
    });
    async function* partials() {
      yield { answer: "A provisional answer.", sourceIds: ["hours"], needsStaff: false };
      await finishPartialStream;
    }

    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt(partials(), new Promise<Output>(() => undefined)),
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
      timeoutMs: 20,
    });
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    releasePartialStream?.();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await reader.read()).toMatchObject({ done: true });
  });

  it("aborts the model stream and closes cleanly when the request disconnects after headers", async () => {
    let attemptSignal: AbortSignal | undefined;
    let releasePartialStream: (() => void) | undefined;
    const finishPartialStream = new Promise<void>((resolve) => {
      releasePartialStream = resolve;
    });
    async function* partials() {
      yield { answer: "A provisional answer.", sourceIds: ["hours"], needsStaff: false };
      await finishPartialStream;
    }
    const requestController = new AbortController();
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: (signal) => {
        attemptSignal = signal;
        return createAttempt(partials(), new Promise<Output>(() => undefined));
      },
      getDraftValue: (partial) => (partial as { answer?: string }).answer ?? null,
      resolveFinal: async (output) => ({ answer: output.answer, status: "answered" }),
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
      timeoutMs: 8_000,
      signal: requestController.signal,
    });
    const reader = response.body!.getReader();
    await expect(reader.read()).resolves.toMatchObject({ done: false });
    requestController.abort();
    expect(attemptSignal?.aborted).toBe(true);
    await expect(reader.read()).resolves.toMatchObject({ done: true });
    releasePartialStream?.();
  });

  it("does not retry the provider after final answer validation fails", async () => {
    const createFallbackAttempt = vi.fn();
    const response = createAnswerStreamResponse<Output, string, Final>({
      createAttempt: () => createAttempt((async function* () {})(), Promise.resolve({ answer: "Unsupported.", sourceIds: [], needsStaff: true })),
      createFallbackAttempt,
      shouldFallback: () => true,
      getDraftValue: () => null,
      resolveFinal: async () => {
        throw new Error("recording failed");
      },
      onFailure: async () => undefined,
      errorMessage: "Unable to answer.",
    });

    const events = [];
    for await (const event of parseAnswerStream<string, Final>(response.body!)) events.push(event);
    expect(events).toMatchObject([{ type: "error", message: "Unable to answer.", aiError: { category: "unknown" } }]);
    expect(createFallbackAttempt).not.toHaveBeenCalled();
  });
});
