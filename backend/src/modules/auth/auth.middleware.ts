import { authService, AuthError } from "./auth.service";
import { AuthUser } from "./auth.types";

export const AUTH_COOKIE_NAME = "kaamsetu_session";

export interface AuthenticatedRequestContext {
  user: AuthUser;
  token: string;
}

/**
 * Extracts session token from either HTTP Cookies or Authorization Bearer header.
 */
export function extractTokenFromRequest(req: Request): string | null {
  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  // 2. Check Cookie header
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith(`${AUTH_COOKIE_NAME}=`)) {
        const token = cookie.slice(AUTH_COOKIE_NAME.length + 1).trim();
        if (token) return token;
      }
    }
  }

  return null;
}

/**
 * Server-side guard to authenticate requests to protected API routes.
 * Throws AuthError(401) if credentials are missing, invalid, or expired.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedRequestContext> {
  const token = extractTokenFromRequest(req);

  if (!token) {
    throw new AuthError(
      "Authentication required. Missing session token or Authorization header.",
      "UNAUTHORIZED",
      401
    );
  }

  const user = await authService.verifySession(token);
  if (!user) {
    throw new AuthError(
      "Invalid, expired, or revoked session. Please sign in again.",
      "UNAUTHORIZED",
      401
    );
  }

  return { user, token };
}

/**
 * Cookie attributes for setting authentication session cookies.
 */
export const AUTH_COOKIE_OPTIONS = {
  name: AUTH_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 24 * 60 * 60, // 1 day in seconds
};
