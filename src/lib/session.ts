import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export type SessionRole = "admin" | "family";

type SessionPayload = {
  role: SessionRole;
  expiresAt: number;
  childName?: string;
};

const COOKIE_NAME = "brightflare_session";
const SESSION_SECONDS = 60 * 30;

function getSessionSecret(): string | null {
  return process.env.BRIGHTFLARE_SESSION_SECRET || null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isValidDemoPin(role: SessionRole, pin: string): boolean {
  const expected =
    role === "admin"
      ? process.env.BRIGHTFLARE_ADMIN_PIN
      : process.env.BRIGHTFLARE_FAMILY_PIN;

  if (!expected || pin.length > 32) return false;
  const actualHash = createHash("sha256").update(pin).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function createSessionToken(role: SessionRole, childName?: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({ role, childName, expiresAt: Date.now() + SESSION_SECONDS * 1000 }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function getSession(request: NextRequest): SessionPayload | null {
  const secret = getSessionSecret();
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("role" in decoded) ||
      !("expiresAt" in decoded)
    ) {
      return null;
    }
    if (
      (decoded.role !== "admin" && decoded.role !== "family") ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt < Date.now()
    ) {
      return null;
    }
    if (decoded.role === "family" && (!("childName" in decoded) || decoded.childName !== "Mia Carter")) {
      return null;
    }
    return decoded as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionRole(request: NextRequest): SessionRole | null {
  return getSession(request)?.role || null;
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    return originHost === request.nextUrl.host || originHost === request.headers.get("host");
  } catch {
    return false;
  }
}

export { COOKIE_NAME, SESSION_SECONDS };
