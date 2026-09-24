import { classifyAIError } from "@/lib/ai-errors";

type AskAttempt = {
  requestId: string;
  requestElapsedMs: number;
  attempt: "primary" | "fallback";
  modelId: string;
  provider: string;
  budgetMs: number;
  signal?: AbortSignal;
};

function classifyAskError(error: unknown): { outcome: "timeout" | "cancel" | "capacity" | "auth" | "other"; diagnosis: ReturnType<typeof classifyAIError> } {
  const diagnosis = classifyAIError(error);
  const outcome = diagnosis.category === "timeout" ? "timeout"
    : diagnosis.category === "cancelled" ? "cancel"
      : diagnosis.category === "quota" || diagnosis.category === "capacity" ? "capacity"
        : diagnosis.category === "auth" ? "auth" : "other";
  return { outcome, diagnosis };
}

function emitAskDiagnostic(event: Record<string, string | number | undefined>) {
  console.info("brightflare.ask.diagnostic", JSON.stringify(Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined))));
}

export function logAskFailure(requestId: string, error: unknown, elapsedMs: number) {
  const diagnosis = classifyAIError(error);
  const classified = classifyAskError(error);
  emitAskDiagnostic({ event: "request_failure", requestId, outcome: classified.outcome, category: diagnosis.category, errorClass: diagnosis.errorClass, code: diagnosis.code, statusCode: diagnosis.statusCode, providerRequestId: diagnosis.requestId, retryAfterSeconds: diagnosis.retryAfterSeconds, providerMessage: diagnosis.providerMessage, elapsedMs });
}

export function logAskCheckpoint(requestId: string, checkpoint: "request_start" | "preflight_complete" | "finalization_start" | "finalization_end", elapsedMs: number) {
  emitAskDiagnostic({ event: checkpoint, requestId, elapsedMs });
}

export function startAskAttempt(input: AskAttempt) {
  const startedAt = Date.now();
  let hasFinished = false;
  const terminalTimer = setTimeout(() => {
    const timeoutError = Object.assign(new Error("Attempt deadline reached."), { name: "TimeoutError" });
    finish("timeout", classifyAIError(timeoutError));
  }, Math.max(1, input.budgetMs));
  function finish(outcome: "success" | "timeout" | "cancel" | "capacity" | "auth" | "other", diagnosis?: ReturnType<typeof classifyAIError>) {
    if (hasFinished) return;
    hasFinished = true;
    clearTimeout(terminalTimer);
    input.signal?.removeEventListener("abort", handleAbort);
    emitAskDiagnostic({
      event: "attempt_end",
      requestId: input.requestId,
      attempt: input.attempt,
      modelId: input.modelId,
      provider: input.provider,
      outcome,
      ...(diagnosis ? { category: diagnosis.category, errorClass: diagnosis.errorClass, statusCode: diagnosis.statusCode } : {}),
      ...(diagnosis?.code ? { code: diagnosis.code } : {}),
      ...(diagnosis?.requestId ? { providerRequestId: diagnosis.requestId } : {}),
      ...(diagnosis?.retryAfterSeconds !== undefined ? { retryAfterSeconds: diagnosis.retryAfterSeconds } : {}),
      ...(diagnosis?.providerMessage ? { providerMessage: diagnosis.providerMessage } : {}),
      elapsedMs: Date.now() - startedAt,
      budgetMs: input.budgetMs,
    });
  }
  function handleAbort() {
    const isTimedOut = Date.now() - startedAt >= input.budgetMs;
    const abortError = isTimedOut ? Object.assign(new Error("Attempt deadline reached."), { name: "TimeoutError" }) : Object.assign(new Error("Attempt cancelled."), { name: "AbortError" });
    finish(isTimedOut ? "timeout" : "cancel", classifyAIError(abortError));
  }
  emitAskDiagnostic({
    event: "attempt_start",
    requestId: input.requestId,
    attempt: input.attempt,
    modelId: input.modelId,
    provider: input.provider,
    elapsedMs: input.requestElapsedMs,
    budgetMs: input.budgetMs,
  });
  if (input.signal?.aborted) handleAbort();
  else input.signal?.addEventListener("abort", handleAbort, { once: true });
  return {
    succeed() { finish("success"); },
    fail(error: unknown) {
      const classified = classifyAskError(error);
      finish(classified.outcome, classified.diagnosis);
    },
  };
}
