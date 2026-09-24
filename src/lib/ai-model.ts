import { google } from "@ai-sdk/google";
import { gateway } from "ai";
import { isAIOverload } from "@/lib/ai-errors";

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

export function isGeminiOverloaded(error: unknown): boolean {
  return isAIOverload(error);
}
