import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  COOKIE_NAME,
  createSessionToken,
  getSessionRole,
  isValidDemoPin,
} from "./session";

describe("demo session boundaries", () => {
  beforeEach(() => {
    process.env.BRIGHTFLARE_SESSION_SECRET = "a-long-local-test-secret";
    process.env.BRIGHTFLARE_ADMIN_PIN = "admin-secret";
    process.env.BRIGHTFLARE_FAMILY_PIN = "family-secret";
  });

  afterEach(() => {
    delete process.env.BRIGHTFLARE_SESSION_SECRET;
    delete process.env.BRIGHTFLARE_ADMIN_PIN;
    delete process.env.BRIGHTFLARE_FAMILY_PIN;
  });

  it("keeps family and staff credentials separate", () => {
    expect(isValidDemoPin("family", "family-secret")).toBe(true);
    expect(isValidDemoPin("admin", "family-secret")).toBe(false);
  });

  it("rejects a modified family session token", () => {
    const token = createSessionToken("family", "Mia Carter");
    expect(token).not.toBeNull();
    const request = new NextRequest("http://localhost:3000/api/auth");
    request.cookies.set(COOKIE_NAME, token!);
    expect(getSessionRole(request)).toBe("family");

    request.cookies.set(COOKIE_NAME, `${token}tampered`);
    expect(getSessionRole(request)).toBeNull();
  });
});
