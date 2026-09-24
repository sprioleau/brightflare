import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, getSession, isSameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const parsed = z.object({ scope: z.literal("family") }).safeParse(body);
  if (body !== null && !parsed.success) {
    return NextResponse.json({ error: "Choose a valid logout scope." }, { status: 400 });
  }
  const session = getSession(request);
  const isFamilyScoped = parsed.success;
  const shouldDeleteSession = !isFamilyScoped || session?.role === "family";
  const response = NextResponse.json({ role: shouldDeleteSession ? null : session?.role ?? null });
  if (shouldDeleteSession) {
    response.cookies.delete(COOKIE_NAME);
  }
  return response;
}
