import { NextResponse } from "next/server";
import {
  authService,
  AUTH_COOKIE_OPTIONS,
  extractTokenFromRequest,
} from "../../../../../backend/src/modules/auth/index.ts";

export async function POST(req: Request) {
  try {
    const token = extractTokenFromRequest(req);
    if (token) {
      await authService.signOut(token);
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: "Logged out successfully",
        },
      },
      { status: 200 }
    );

    // Clear session cookie
    response.cookies.set({
      name: AUTH_COOKIE_OPTIONS.name,
      value: "",
      httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
      secure: AUTH_COOKIE_OPTIONS.secure,
      sameSite: AUTH_COOKIE_OPTIONS.sameSite,
      path: AUTH_COOKIE_OPTIONS.path,
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    const formatted = authService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
