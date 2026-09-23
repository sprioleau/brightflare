import { afterEach, describe, expect, it } from "vitest";
import { getGeminiModel, getGeminiOverloadFallbackModel, isGeminiOverloaded } from "./ai-model";

describe("Gemini model configuration", () => {
  const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL_ID;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL_ID;
    else process.env.GEMINI_MODEL_ID = originalModel;
  });

  it("selects Gemini 3.5 Flash-Lite for a configured direct Google key", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL_ID;

    expect(getGeminiModel()?.modelId).toBe("gemini-3.5-flash-lite");
  });

  it("allows an explicit model override", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.GEMINI_MODEL_ID = "gemini-3.6-flash";

    expect(getGeminiModel()?.modelId).toBe("gemini-3.6-flash");
    expect(getGeminiOverloadFallbackModel()).toBeNull();
  });

  it("makes Gemini 3.5 Flash available if Flash-Lite reports capacity pressure", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL_ID;

    expect(getGeminiOverloadFallbackModel()?.modelId).toBe("gemini-3.5-flash");
    expect(isGeminiOverloaded(new Error("This model is currently experiencing high demand"))).toBe(true);
    expect(isGeminiOverloaded(new Error("You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests"))).toBe(true);
    expect(isGeminiOverloaded(new Error("Invalid API key"))).toBe(false);
  });
});
