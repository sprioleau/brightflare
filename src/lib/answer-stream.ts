import type { SafeAIError } from "@/lib/ai-errors";
import { getPublicAIError } from "@/lib/ai-errors";

export type AnswerStreamEvent<TDraft, TFinal> =
  | { type: "draft"; value: TDraft }
  | { type: "reset" }
  | { type: "final"; value: TFinal }
  | { type: "error"; message: string; aiError?: SafeAIError };

type StreamAttempt<TOutput> = {
  partialOutputStream: AsyncIterable<unknown>;
  output: PromiseLike<TOutput>;
  getOriginalError?: () => unknown;
};

type MaybePromise<T> = T | PromiseLike<T>;

export type RequestDeadline = {
  signal: AbortSignal;
  outcome: Promise<"timeout" | "cancelled">;
  remainingMs: () => number;
  clear: () => void;
};

export function createRequestDeadline(signal: AbortSignal, timeoutMs: number): RequestDeadline {
  const abortController = new AbortController();
  const startedAt = Date.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settleOutcome: ((outcome: "timeout" | "cancelled") => void) | undefined;
  let hasCleared = false;
  const outcome = new Promise<"timeout" | "cancelled">((resolve) => {
    settleOutcome = resolve;
    if (signal.aborted) {
      abortController.abort(signal.reason);
      resolve("cancelled");
      return;
    }
    signal.addEventListener("abort", handleAbort, { once: true });
    timeoutId = setTimeout(() => {
      abortController.abort(new Error("The ask request timed out."));
      resolve("timeout");
    }, timeoutMs);
  });

  function handleAbort() {
    if (timeoutId) clearTimeout(timeoutId);
    abortController.abort(signal.reason);
    settleOutcome?.("cancelled");
  }

  function clear() {
    if (hasCleared) return;
    hasCleared = true;
    if (timeoutId) clearTimeout(timeoutId);
    signal.removeEventListener("abort", handleAbort);
  }

  return {
    signal: abortController.signal,
    outcome,
    remainingMs: () => Math.max(0, timeoutMs - (Date.now() - startedAt)),
    clear,
  };
}

export function createAnswerStreamResponse<TOutput, TDraft, TFinal>({
  createAttempt,
  createFallbackAttempt,
  additionalFallbackAttempts,
  shouldFallback,
  signal,
  timeoutMs,
  timeoutMessage,
  getDraftValue,
  resolveFinal,
  onFailure,
  errorMessage,
}: {
  createAttempt: (signal: AbortSignal) => MaybePromise<StreamAttempt<TOutput>>;
  createFallbackAttempt?: (signal: AbortSignal) => MaybePromise<StreamAttempt<TOutput> | null>;
  additionalFallbackAttempts?: Array<(signal: AbortSignal) => MaybePromise<StreamAttempt<TOutput> | null>>;
  shouldFallback?: (error: unknown) => boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  timeoutMessage?: string;
  getDraftValue: (partial: unknown) => TDraft | null;
  resolveFinal: (output: TOutput) => Promise<TFinal>;
  onFailure: (error?: unknown) => Promise<void>;
  errorMessage: string;
}) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let isCanceled = false;
  let hasTimedOut = false;
  let isClosed = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  function cancelStream(reason?: unknown, shouldCloseController = false) {
    if (isCanceled) return;
    isCanceled = true;
    if (timeoutId) clearTimeout(timeoutId);
    abortController.abort(reason);
    if (shouldCloseController && streamController && !isClosed) {
      isClosed = true;
      streamController.close();
    }
    signal?.removeEventListener("abort", handleSignalAbort);
  }

  function handleSignalAbort() {
    cancelStream(signal?.reason, true);
  }

  if (signal?.aborted) cancelStream(signal.reason);
  else signal?.addEventListener("abort", handleSignalAbort, { once: true });
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      if (isCanceled) {
        isClosed = true;
        controller.close();
        return;
      }
      let hasDraft = false;
      let hasStartedFinalization = false;
      let previousDraft: TDraft | null = null;
      function write(event: AnswerStreamEvent<TDraft, TFinal>) {
        if (isCanceled || isClosed || (hasTimedOut && event.type !== "reset" && event.type !== "error")) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      async function runAttempt(result: StreamAttempt<TOutput>) {
        const outputPromise = Promise.resolve(result.output);
        void outputPromise.catch(() => undefined);
        for await (const partial of result.partialOutputStream) {
          const nextDraft = getDraftValue(partial);
          if (nextDraft !== null && JSON.stringify(nextDraft) !== JSON.stringify(previousDraft)) {
            previousDraft = nextDraft;
            hasDraft = true;
            write({ type: "draft", value: nextDraft });
          } else if (nextDraft === null && hasDraft) {
            hasDraft = false;
            previousDraft = null;
            write({ type: "reset" });
          }
        }
        return outputPromise;
      }

      async function runOperation() {
        let output!: TOutput;
        let currentAttempt: StreamAttempt<TOutput> | undefined;
        try {
          currentAttempt = await createAttempt(abortController.signal);
          output = await runAttempt(currentAttempt);
        } catch (error) {
          const attemptError = currentAttempt?.getOriginalError?.() ?? error;
          const fallbackFactories = [createFallbackAttempt, ...additionalFallbackAttempts ?? []].filter((factory) => factory !== undefined);
          if (hasTimedOut || signal?.aborted || !shouldFallback?.(attemptError) || fallbackFactories.length === 0) throw attemptError;
          if (hasDraft) {
            write({ type: "reset" });
            hasDraft = false;
            previousDraft = null;
          }
          let fallbackError: unknown = attemptError;
          let hasSucceeded = false;
          for (const createFallback of fallbackFactories) {
            if (hasTimedOut || signal?.aborted || abortController.signal.aborted) break;
            let fallbackAttempt: StreamAttempt<TOutput> | null;
            try {
              fallbackAttempt = await createFallback(abortController.signal);
            } catch (error) {
              fallbackError = error;
              if (!shouldFallback?.(fallbackError)) break;
              continue;
            }
            if (!fallbackAttempt) continue;
            if (hasDraft) {
              write({ type: "reset" });
              hasDraft = false;
              previousDraft = null;
            }
            try {
              output = await runAttempt(fallbackAttempt);
              hasSucceeded = true;
              break;
            } catch (error) {
              fallbackError = fallbackAttempt.getOriginalError?.() ?? error;
              if (!shouldFallback?.(fallbackError)) break;
            }
          }
          if (!hasSucceeded) throw fallbackError;
        }
        if (isCanceled || hasTimedOut || signal?.aborted) return;
        hasStartedFinalization = true;
        const finalValue = await resolveFinal(output);
        if (isCanceled || hasTimedOut || signal?.aborted) return;
        write({ type: "final", value: finalValue });
        hasDraft = false;
      }

      async function run() {
        const operation = runOperation();
        try {
          if (timeoutMs) {
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
              timeoutId = setTimeout(() => {
                hasTimedOut = true;
                abortController.abort(new Error("The answer stream timed out."));
                reject(new Error("The answer stream timed out."));
              }, timeoutMs);
            });
            await Promise.race([operation, timeoutPromise]);
          } else {
            await operation;
          }
        } catch (error) {
          if (isCanceled || (signal?.aborted && !hasTimedOut)) return;
          if (hasDraft) write({ type: "reset" });
          const aiError = hasTimedOut
            ? { category: "timeout" as const, message: timeoutMessage ?? "This is taking longer than expected. Please try again or ask the front desk team." }
            : getPublicAIError(error);
          write({
            type: "error",
            message: hasTimedOut ? timeoutMessage ?? "This is taking longer than expected. Please try again or ask the front desk team." : aiError.category === "unknown" ? errorMessage : aiError.message,
            aiError,
          });
          if (hasTimedOut && !hasStartedFinalization) {
            void Promise.resolve().then(() => onFailure(error)).catch(() => undefined);
          } else if (!hasTimedOut) {
            await onFailure(error).catch(() => undefined);
          }
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          if (!isCanceled && !isClosed) {
            isClosed = true;
            controller.close();
          }
          signal?.removeEventListener("abort", handleSignalAbort);
        }
      }

      void run();
    },
    cancel() {
      cancelStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function* parseAnswerStream<TDraft, TFinal>(stream: ReadableStream<Uint8Array>): AsyncGenerator<AnswerStreamEvent<TDraft, TFinal>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done: isDone, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !isDone });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line) yield JSON.parse(line) as AnswerStreamEvent<TDraft, TFinal>;
        newlineIndex = buffer.indexOf("\n");
      }
      if (isDone) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer) as AnswerStreamEvent<TDraft, TFinal>;
  } finally {
    reader.releaseLock();
  }
}
