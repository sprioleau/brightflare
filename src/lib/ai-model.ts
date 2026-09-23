import { google } from "@ai-sdk/google";
import { gateway } from "ai";

export function getGeminiModel() {
  const modelId = process.env.GEMINI_MODEL_ID;
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return google(modelId || "gemini-3.5-flash-lite");
  if (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
  ) {
    return gateway(`google/${modelId || "gemini-2.5-flash-lite"}`);
  }
  return null;
}
