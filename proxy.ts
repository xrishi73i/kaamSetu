import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const AUTH_COOKIE_NAME = "kaamsetu_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Protect /dashboard and any future internal protected routes
  const isProtectedRoute = pathname.startsWith("/dashboard");

  if (isProtectedRoute && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated and visiting /login or /register, redirect to /dashboard
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes handle their own auth guards)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - dev (development testing pages)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|dev).*)",
  ],
};
