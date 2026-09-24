import { describe, expect, it } from "vitest";
import { classifyAIError, getPublicAIError } from "./ai-errors";

describe("AI error diagnosis", () => {
  it("classifies provider quota and capacity errors through SDK wrappers", () => {
    const nestedQuota = new Error("No output generated", {
      cause: { name: "RetryError", lastError: { name: "APICallError", statusCode: 429, responseBody: JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }) } },
    });
    const streamCapacity = { type: "error", error: { name: "StreamProviderError", statusCode: 503, code: "UNAVAILABLE", message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." } };

    expect(classifyAIError(nestedQuota)).toMatchObject({ category: "quota", statusCode: 429 });
    expect(classifyAIError(streamCapacity)).toMatchObject({ category: "capacity", statusCode: 503, code: "UNAVAILABLE", providerMessage: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." });
  });

  it("does not let nested auth or invalid-input errors get masked by an outer capacity status", () => {
    expect(classifyAIError({ statusCode: 503, cause: { statusCode: 401, message: "Invalid API key" } }).category).toBe("auth");
    expect(classifyAIError({ statusCode: 503, errors: [{ statusCode: 400, message: "INVALID_ARGUMENT" }] }).category).toBe("invalid_input");
  });

  it("redacts credentials, payload-like text and quoted contents from server messages", () => {
    const credentialError = classifyAIError({ name: "APICallError", statusCode: 503, message: "Provider failure; api_key=secret123; https://example.test/?token=secret" });
    const longQuotedError = classifyAIError({ name: "APICallError", statusCode: 503, message: `Rejected \\"${"private-value ".repeat(700)}\\"` });
    const promptError = classifyAIError({ name: "APICallError", statusCode: 503, message: "prompt=private words" });

    expect(JSON.stringify(credentialError)).not.toContain("secret123");
    expect(JSON.stringify(credentialError)).not.toContain("https://");
    expect(JSON.stringify(longQuotedError)).not.toContain("private-value");
    expect(JSON.stringify(promptError)).not.toContain("private words");
    expect(getPublicAIError({ name: "APICallError", statusCode: 503, message: "Provider failure" })).not.toHaveProperty("providerMessage");
  });

  it("classifies auth, input, timeout and cancellation separately", () => {
    expect(classifyAIError(new Error("Invalid API key; quota exceeded")).category).toBe("auth");
    expect(classifyAIError({ statusCode: 400, message: "INVALID_ARGUMENT" }).category).toBe("invalid_input");
    expect(classifyAIError(Object.assign(new Error("timeout"), { name: "TimeoutError" })).category).toBe("timeout");
    expect(classifyAIError(Object.assign(new Error("cancel"), { name: "AbortError" })).category).toBe("cancelled");
  });
});
