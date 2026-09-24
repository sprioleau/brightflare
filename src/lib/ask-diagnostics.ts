type AskAttempt = {
  requestId: string;
  requestElapsedMs: number;
  attempt: "primary" | "fallback";
  modelId: string;
  provider: string;
  budgetMs: number;
  signal?: AbortSignal;
};

function classifyAskError(error: unknown): { outcome: "timeout" | "cancel" | "capacity" | "auth" | "other"; statusCode?: number } {
  const pending: unknown[] = [error];
  const visited = new Set<unknown>();
  let inspected = 0;
  let statusCode: number | undefined;
  let code = "";
  let isTimeout = false;
  while (pending.length > 0 && inspected < 20) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    inspected += 1;
    const record = current as Record<string, unknown>;
    if (current instanceof Error && current.name === "TimeoutError") isTimeout = true;
    const rawStatus = record.statusCode ?? record.status;
    if (statusCode === undefined && typeof rawStatus === "number" && rawStatus >= 100 && rawStatus <= 599) statusCode = rawStatus;
    if (typeof record.code === "string") code = record.code.toUpperCase().slice(0, 64);
    pending.push(record.cause, record.lastError);
    if (Array.isArray(record.errors)) pending.push(...record.errors.slice(0, 10));
  }
  if (isTimeout) return { outcome: "timeout", ...(statusCode ? { statusCode } : {}) };
  if (["ABORT_ERR", "ABORTED", "CANCELLED", "CANCELED"].includes(code)) return { outcome: "cancel", ...(statusCode ? { statusCode } : {}) };
  if (statusCode === 401 || statusCode === 403 || /AUTH|PERMISSION_DENIED/.test(code)) return { outcome: "auth", ...(statusCode ? { statusCode } : {}) };
  if (statusCode === 429 || statusCode === 503 || /RESOURCE_EXHAUSTED|UNAVAILABLE|OVERLOAD/.test(code)) return { outcome: "capacity", ...(statusCode ? { statusCode } : {}) };
  return { outcome: "other", ...(statusCode ? { statusCode } : {}) };
}

function emitAskDiagnostic(event: Record<string, string | number | undefined>) {
  console.info("brightflare.ask.diagnostic", JSON.stringify(Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined))));
}

export function logAskFailure(requestId: string, error: unknown, elapsedMs: number) {
  const classified = classifyAskError(error);
  emitAskDiagnostic({ event: "request_failure", requestId, ...classified, elapsedMs });
}

export function logAskCheckpoint(requestId: string, checkpoint: "request_start" | "preflight_complete" | "finalization_start" | "finalization_end", elapsedMs: number) {
  emitAskDiagnostic({ event: checkpoint, requestId, elapsedMs });
}

export function startAskAttempt(input: AskAttempt) {
  const startedAt = Date.now();
  let hasFinished = false;
  const terminalTimer = setTimeout(() => finish("timeout"), Math.max(1, input.budgetMs));
  function finish(outcome: "success" | "timeout" | "cancel" | "capacity" | "auth" | "other", statusCode?: number) {
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
      ...(statusCode ? { statusCode } : {}),
      elapsedMs: Date.now() - startedAt,
      budgetMs: input.budgetMs,
    });
  }
  function handleAbort() {
    finish(Date.now() - startedAt >= input.budgetMs ? "timeout" : "cancel");
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
      finish(classified.outcome, classified.statusCode);
    },
  };
}
