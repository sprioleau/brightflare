import { google } from "@ai-sdk/google";
import { gateway } from "ai";

function getConfiguredGeminiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || "gemini-3.5-flash-lite";
}

function getGeminiProviderModel(modelId: string) {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return google(modelId);
  if (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
  ) {
    return gateway(`google/${modelId}`);
  }
  return null;
}

export function getGeminiModel() {
  return getGeminiProviderModel(getConfiguredGeminiModelId());
}

export function getGeminiOverloadFallbackModel() {
  const modelId = getConfiguredGeminiModelId();
  const fallbackModelId = modelId === "gemini-3.6-flash"
    ? "gemini-3.5-flash-lite"
    : modelId === "gemini-3.5-flash-lite"
      ? "gemini-3.5-flash"
      : null;
  return fallbackModelId ? getGeminiProviderModel(fallbackModelId) : null;
}

type ErrorDetails = {
  messages: string[];
  statusCodes: number[];
};

function collectErrorDetails(error: unknown): ErrorDetails {
  const messages: string[] = [];
  const statusCodes: number[] = [];
  const visited = new Set<object>();
  const pending: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];

  while (pending.length > 0 && visited.size < 64) {
    const { value, depth } = pending.pop()!;
    if (typeof value === "string") {
      messages.push(value);
      if (depth < 6 && /^[\s]*[\[{]/.test(value)) {
        try {
          pending.push({ value: JSON.parse(value), depth: depth + 1 });
        } catch {
          /*
            Provider response strings can be plain text.
          */
        }
      }
      continue;
    }
    if (!value || typeof value !== "object" || visited.has(value) || depth > 6) continue;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 32)) pending.push({ value: entry, depth: depth + 1 });
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const key of ["message", "status", "code", "type", "reason"]) {
      const fieldValue = record[key];
      if (typeof fieldValue === "string") messages.push(fieldValue);
      if (key === "status" || key === "code") {
        const statusCode = typeof fieldValue === "number"
          ? fieldValue
          : typeof fieldValue === "string" && /^\d{3}$/.test(fieldValue)
            ? Number(fieldValue)
            : undefined;
        if (statusCode !== undefined) statusCodes.push(statusCode);
      }
    }
    const statusCode = record.statusCode;
    if (typeof statusCode === "number") statusCodes.push(statusCode);
    if (typeof statusCode === "string" && /^\d{3}$/.test(statusCode)) statusCodes.push(Number(statusCode));

    for (const key of ["cause", "lastError", "errors", "data", "responseBody", "error", "details"]) {
      if (record[key] !== undefined) pending.push({ value: record[key], depth: depth + 1 });
    }
  }

  return { messages, statusCodes };
}

export function isGeminiOverloaded(error: unknown): boolean {
  const { messages, statusCodes } = collectErrorDetails(error);
  const message = messages.join(" ");
  const hasNonCapacityFailure = statusCodes.some((statusCode) =>
    statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 422,
  ) || /API_KEY_INVALID|UNAUTHENTICATED|PERMISSION_DENIED|INVALID_ARGUMENT|FAILED_PRECONDITION|NOT_FOUND|invalid (?:api )?key|invalid (?:argument|request|input)|malformed request|permission denied|authentication failed/i.test(message);
  if (hasNonCapacityFailure) return false;

  return statusCodes.some((statusCode) => statusCode === 429 || statusCode === 503) ||
    /RESOURCE[_ -]?EXHAUSTED|UNAVAILABLE|high demand|overloaded|rate limit|quota (?:exceeded|exhausted)|temporarily unavailable|service unavailable|capacity/i.test(message);
}
