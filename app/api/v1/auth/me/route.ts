import { NextResponse } from "next/server";
import {
  authService,
  authenticateRequest,
} from "../../../../../backend/src/modules/auth/index.ts";

export async function GET(req: Request) {
  try {
    const { user } = await authenticateRequest(req);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = authService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
