import { google } from "@ai-sdk/google";
import { gateway } from "ai";

export function getGeminiModel() {
  const modelId = process.env.GEMINI_MODEL_ID?.trim() || "gemini-3.6-flash";
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

export function getGeminiOverloadFallbackModel() {
  const modelId = process.env.GEMINI_MODEL_ID?.trim() || "gemini-3.6-flash";
  if (modelId !== "gemini-3.6-flash") return null;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) return google("gemini-3.5-flash-lite");
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) {
    return gateway("google/gemini-3.5-flash-lite");
  }
  return null;
}

export function isGeminiOverloaded(error: unknown): boolean {
  return error instanceof Error && /high demand|overloaded|resource exhausted|rate limit/i.test(error.message);
}
