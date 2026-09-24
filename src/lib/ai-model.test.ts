import { afterEach, describe, expect, it } from "vitest";
import { getGeminiModel, getGeminiOverloadFallbackModel, getOpenRouterFallbackModel, isGeminiOverloaded } from "./ai-model";

describe("Gemini model configuration", () => {
  const originalEnvironment = {
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    VERCEL: process.env.VERCEL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL_ID: process.env.OPENROUTER_MODEL_ID,
  };

  afterEach(() => {
    for (const key of Object.keys(originalEnvironment) as Array<keyof typeof originalEnvironment>) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
    expect(getGeminiOverloadFallbackModel()?.modelId).toBe("gemini-3.5-flash-lite");
  });

  it("uses Gemini 3.5 Flash if Flash-Lite reports capacity pressure", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL_ID;

    expect(getGeminiOverloadFallbackModel()?.modelId).toBe("gemini-3.5-flash");
    expect(isGeminiOverloaded(new Error("This model is currently experiencing high demand"))).toBe(true);
    expect(isGeminiOverloaded(new Error("You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests"))).toBe(true);
  });

  it("leaves OpenRouter disabled when its key is blank", () => {
    process.env.OPENROUTER_API_KEY = "  ";
    expect(getOpenRouterFallbackModel()).toBeNull();
  });

  it("selects the verified GPT OSS free model when OpenRouter is configured", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    delete process.env.OPENROUTER_MODEL_ID;
    expect(getOpenRouterFallbackModel()?.modelId).toBe("openai/gpt-oss-20b:free");
  });

  it("allows a configured OpenRouter model override", () => {
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    process.env.OPENROUTER_MODEL_ID = "openai/gpt-oss-120b:free";
    expect(getOpenRouterFallbackModel()?.modelId).toBe("openai/gpt-oss-120b:free");
  });

  it("uses the 3.5 Flash-Lite fallback through AI Gateway for configured 3.6 Flash", () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    process.env.GEMINI_MODEL_ID = "gemini-3.6-flash";

    expect(getGeminiOverloadFallbackModel()?.modelId).toBe("google/gemini-3.5-flash-lite");
  });

  it("uses 3.5 Flash through AI Gateway when configured Flash-Lite reports capacity pressure", () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "test-gateway-key";
    delete process.env.GEMINI_MODEL_ID;

    expect(getGeminiOverloadFallbackModel()?.modelId).toBe("google/gemini-3.5-flash");
  });

  it("recognizes nested SDK 429 and RESOURCE_EXHAUSTED provider details", () => {
    const error = new Error("The model call failed", {
      cause: {
        name: "APICallError",
        statusCode: 429,
        responseBody: JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Rate limit exceeded",
          },
        }),
      },
    });

    expect(isGeminiOverloaded(error)).toBe(true);
    expect(isGeminiOverloaded({ cause: { data: { error: { status: "RESOURCE_EXHAUSTED" } } } })).toBe(true);
    expect(isGeminiOverloaded({ errors: [{ statusCode: 429, message: "Too many requests" }] })).toBe(true);
  });

  it("recognizes nested 503 UNAVAILABLE capacity errors", () => {
    const retryError = {
      name: "RetryError",
      lastError: {
        name: "APICallError",
        statusCode: 503,
        data: { error: { status: "UNAVAILABLE", message: "Service temporarily unavailable" } },
      },
      errors: [],
    };

    expect(isGeminiOverloaded(retryError)).toBe(true);
    expect(isGeminiOverloaded({ responseBody: JSON.stringify({ error: { status: "UNAVAILABLE" } }) })).toBe(true);
  });

  it("does not retry authentication or invalid-input failures", () => {
    expect(isGeminiOverloaded({ cause: { statusCode: 401, data: { error: { status: "UNAUTHENTICATED", message: "API key not valid" } } } })).toBe(false);
    expect(isGeminiOverloaded({ statusCode: 400, message: "INVALID_ARGUMENT: malformed request" })).toBe(false);
    expect(isGeminiOverloaded(new Error("Invalid API key; quota exceeded"))).toBe(false);
    expect(isGeminiOverloaded(new Error("Internal server error"))).toBe(false);
  });
});
