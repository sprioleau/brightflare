import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { COOKIE_NAME, createSessionToken } from "@/lib/session";

describe("family-scoped logout", () => {
  beforeEach(() => {
    process.env.BRIGHTFLARE_SESSION_SECRET = "a-long-local-test-secret";
  });

  afterEach(() => {
    delete process.env.BRIGHTFLARE_SESSION_SECRET;
  });

  it("preserves a staff session when a parent flow requests family logout", async () => {
    const token = createSessionToken("admin");
    const request = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ scope: "family" }),
    });
    request.cookies.set(COOKIE_NAME, token!);

    const response = await POST(request);

    expect(response.cookies.get(COOKIE_NAME)).toBeUndefined();
    await expect(response.json()).resolves.toEqual({ role: "admin" });
  });

  it("deletes a family session and keeps legacy logout behavior", async () => {
    const familyToken = createSessionToken("family", "Mia Carter");
    const familyRequest = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ scope: "family" }),
    });
    familyRequest.cookies.set(COOKIE_NAME, familyToken!);
    const familyResponse = await POST(familyRequest);

    expect(familyResponse.cookies.get(COOKIE_NAME)?.value).toBe("");

    const adminToken = createSessionToken("admin");
    const legacyRequest = new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" });
    legacyRequest.cookies.set(COOKIE_NAME, adminToken!);
    const legacyResponse = await POST(legacyRequest);

    expect(legacyResponse.cookies.get(COOKIE_NAME)?.value).toBe("");
    await expect(legacyResponse.json()).resolves.toEqual({ role: null });
  });
});
