import { NextResponse, type NextRequest } from "next/server";
import { ANON_COOKIE } from "@/lib/auth/constants";

// Assigns an anonymous user id cookie on first visit. The user row itself is
// created lazily by `getCurrentUserId()` on the server.
export function proxy(request: NextRequest) {
  if (request.cookies.get(ANON_COOKIE)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(ANON_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
