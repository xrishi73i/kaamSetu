import { NextResponse } from "next/server";
import {
  authService,
  ForgotPasswordDto,
} from "../../../../../backend/src/modules/auth/index.ts";

export async function POST(req: Request) {
  try {
    let body: ForgotPasswordDto;
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

    const result = await authService.forgotPassword(body);

    return NextResponse.json(
      {
        success: true,
        data: {
          message: result.message,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = authService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
