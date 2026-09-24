export type AIErrorCategory = "quota" | "capacity" | "timeout" | "auth" | "invalid_input" | "cancelled" | "unknown";

export type SafeAIError = {
  category: AIErrorCategory;
  message: string;
  errorClass?: string;
  code?: string;
  statusCode?: number;
  requestId?: string;
  retryAfterSeconds?: number;
};

export type AIDiagnosis = SafeAIError & { providerMessage?: string };

const publicMessages: Record<AIErrorCategory, string> = {
  quota: "The AI provider quota is exhausted. Try again later or check the provider quota.",
  capacity: "The AI service is temporarily busy. Please try again shortly.",
  timeout: "The AI service took too long to respond. Please try again.",
  auth: "The AI service credentials need attention.",
  invalid_input: "The AI service rejected this request. Review the request and try again.",
  cancelled: "The AI request was cancelled.",
  unknown: "The AI service could not complete the request. Please try again.",
};

type ErrorRecord = Record<string, unknown>;

function boundedString(value: unknown, pattern: RegExp, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength && pattern.test(trimmed) ? trimmed : undefined;
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  let value: string | null | undefined;
  if (headers instanceof Headers) value = headers.get(name);
  else if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const candidate = record[name] ?? record[name.toLowerCase()];
    if (typeof candidate === "string") value = candidate;
    else if (typeof record.get === "function") value = (record.get as (key: string) => string | null)(name);
  }
  return typeof value === "string" ? value : undefined;
}

function sanitizeProviderMessage(message: string): string | undefined {
  if (/\b(prompt|answer|source(?:s| text)?|question|conversation|family|child|content|input|output|transcript)\b/i.test(message)) return undefined;
  let sanitized = message
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bAIza[\w-]{20,}\b/g, "[redacted]")
    .replace(/(api[_-]?key|access[_-]?token|authorization|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\{[\s\S]{0,10000}?\}/g, "[payload]")
    .replace(/(["'`])[\s\S]*?\1/g, "[text]")
    .replace(/(["'`])[\s\S]*$/g, "[text]")
    .replace(/\b(api[_-]?key|access[_-]?token|authorization|secret|prompt|answer|source|question|content|input|output|body|text)\s*[:=]\s*[^,;\s]+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized || sanitized.length > 240) sanitized = sanitized.slice(0, 240);
  return sanitized || undefined;
}

export function classifyAIError(error: unknown): AIDiagnosis {
  const pending: unknown[] = [error];
  const visited = new Set<object>();
  const details: ErrorRecord[] = [];
  let inspected = 0;
  while (pending.length > 0 && inspected < 64) {
    const value = pending.shift();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    inspected += 1;
    const record = value as ErrorRecord;
    details.push(record);
    for (const key of ["cause", "lastError", "errors", "data", "responseBody", "error", "details"]) {
      const nested = record[key];
      if (Array.isArray(nested)) pending.push(...nested.slice(0, 12));
      else if (nested && typeof nested === "object") pending.push(nested);
      else if (typeof nested === "string" && nested.length < 20_000 && /^[\s]*[\[{]/.test(nested)) {
        try { pending.push(JSON.parse(nested)); } catch { /* Provider text is never emitted. */ }
      }
    }
  }

  let category: AIErrorCategory = "unknown";
  let statusCode: number | undefined;
  let code: string | undefined;
  let errorClass: string | undefined;
  let requestId: string | undefined;
  let retryAfterSeconds: number | undefined;
  let providerMessage: string | undefined;
  const statusCodes: number[] = [];
  for (const record of details) {
    const status = record.statusCode ?? record.status;
    const numericStatus = typeof status === "number" ? status : typeof status === "string" && /^\d{3}$/.test(status) ? Number(status) : undefined;
    if (numericStatus && numericStatus >= 100 && numericStatus <= 599) statusCodes.push(numericStatus);
    if (typeof record.code === "number" && record.code >= 100 && record.code <= 599) statusCodes.push(record.code);
    const rawCode = [record.code, record.status, record.reason, record.type].find((value) => typeof value === "string" && !["error", "unknown"].includes(value.toLowerCase()));
    code ??= boundedString(rawCode, /^[A-Za-z0-9_.-]+$/, 64);
    errorClass ??= boundedString(record.name, /^[A-Za-z][A-Za-z0-9_]{0,63}$/, 64);
    const headers = record.responseHeaders ?? record.headers;
    requestId ??= boundedString(readHeader(headers, "x-goog-request-id") ?? readHeader(headers, "x-request-id") ?? readHeader(headers, "request-id"), /^[A-Za-z0-9._:-]+$/, 128);
    const retryValue = readHeader(headers, "retry-after");
    if (retryAfterSeconds === undefined && retryValue && /^\d{1,6}$/.test(retryValue)) retryAfterSeconds = Math.min(Number(retryValue), 86_400);
    providerMessage ??= typeof record.message === "string" ? sanitizeProviderMessage(record.message) : undefined;
  }

  statusCode = statusCodes.find((status) => status === 401 || status === 403)
    ?? statusCodes.find((status) => status === 400 || status === 404 || status === 422)
    ?? statusCodes.find((status) => status === 429)
    ?? statusCodes.find((status) => status === 503)
    ?? statusCodes[0];

  const haystack = details.flatMap((record) => [record.code, record.status, record.reason, record.type, record.message, record.responseBody, record.data])
    .filter((value): value is string => typeof value === "string")
    .join(" ").toUpperCase().slice(0, 100_000);
  const isTimeout = details.some((record) => record.name === "TimeoutError" || record.name === "AI_TimeoutError");
  const isAbort = details.some((record) => record.name === "AbortError") || /\bABORT_ERR\b|\bCANCELLED\b|\bCANCELED\b/.test(haystack);
  const isAuth = statusCode === 401 || statusCode === 403 || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|AUTHENTICATION|INVALID_API_KEY|INVALID API KEY|INVALID CREDENTIAL/.test(haystack);
  const isInput = [400, 404, 422].includes(statusCode ?? 0) || /INVALID_ARGUMENT|FAILED_PRECONDITION|MALFORMED_REQUEST|INVALID_INPUT/.test(haystack);
  const isQuota = statusCode === 429 || /RESOURCE[_ -]?EXHAUSTED|QUOTA[_ -]?(?:EXCEEDED|EXHAUSTED)|RATE[_ -]?LIMIT/.test(haystack);
  const isCapacity = statusCode === 503 || /UNAVAILABLE|OVERLOADED|CAPACITY|HIGH DEMAND/.test(haystack);
  category = isTimeout ? "timeout" : isAbort ? "cancelled" : isAuth ? "auth" : isInput ? "invalid_input" : isQuota ? "quota" : isCapacity ? "capacity" : "unknown";
  return {
    category,
    message: publicMessages[category],
    ...(errorClass ? { errorClass } : {}),
    ...(code ? { code } : {}),
    ...(statusCode ? { statusCode } : {}),
    ...(requestId ? { requestId } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(providerMessage ? { providerMessage } : {}),
  };
}

export function getPublicAIError(error: unknown): SafeAIError {
  const { providerMessage: _providerMessage, ...safeError } = classifyAIError(error);
  return safeError;
}

export function logAIErrorDiagnostic(area: "ask" | "admin_assist" | "admin_recommendations", requestId: string, error: unknown) {
  const diagnosis = classifyAIError(error);
  const { requestId: providerRequestId, providerMessage, ...safeFields } = diagnosis;
  console.error("brightflare.ai.failure", JSON.stringify({
    area,
    requestId,
    ...safeFields,
    ...(providerRequestId ? { providerRequestId } : {}),
    ...(providerMessage ? { providerMessage } : {}),
  }));
}

export function isAIOverload(error: unknown): boolean {
  const category = classifyAIError(error).category;
  return category === "quota" || category === "capacity";
}
