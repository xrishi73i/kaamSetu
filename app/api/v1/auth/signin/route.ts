import { NextResponse } from "next/server";
import {
  authService,
  AUTH_COOKIE_OPTIONS,
  SignInDto,
} from "../../../../../backend/src/modules/auth/index.ts";

export async function POST(req: Request) {
  try {
    let body: SignInDto;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid JSON request payload.",
          },
        },
        { status: 400 }
      );
    }

    const session = await authService.signIn(body);

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: session.user,
          token: session.token,
        },
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: AUTH_COOKIE_OPTIONS.name,
      value: session.token,
      httpOnly: AUTH_COOKIE_OPTIONS.httpOnly,
      secure: AUTH_COOKIE_OPTIONS.secure,
      sameSite: AUTH_COOKIE_OPTIONS.sameSite,
      path: AUTH_COOKIE_OPTIONS.path,
      maxAge: AUTH_COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch (err: unknown) {
    const formatted = authService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
