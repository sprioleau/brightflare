import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  createSessionToken,
  getSession,
  isSameOrigin,
  isValidDemoPin,
  SESSION_SECONDS,
} from "@/lib/session";

const credentialsSchema = z.object({
  role: z.enum(["admin", "family"]),
  pin: z.string().min(1).max(32),
  childName: z.string().trim().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const session = getSession(request);
  return NextResponse.json({ role: session?.role || null, childName: session?.childName || null });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid PIN." }, { status: 400 });
  }
  if (!isValidDemoPin(parsed.data.role, parsed.data.pin)) {
    return NextResponse.json({ error: "That PIN did not match." }, { status: 401 });
  }
  const hasCorrectChild =
    parsed.data.role !== "family" ||
    parsed.data.childName?.toLocaleLowerCase().replace(/\s+/g, " ") === "mia carter";
  if (!hasCorrectChild) {
    return NextResponse.json({ error: "That child and PIN did not match." }, { status: 401 });
  }
  const childName = parsed.data.role === "family" ? "Mia Carter" : undefined;
  const token = createSessionToken(parsed.data.role, childName);
  if (!token) {
    return NextResponse.json({ error: "Demo sign-in is not configured." }, { status: 503 });
  }
  const response = NextResponse.json({ role: parsed.data.role, childName: childName || null });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
