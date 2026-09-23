import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, isSameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const response = NextResponse.json({ role: null });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
