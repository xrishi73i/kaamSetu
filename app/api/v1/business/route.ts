import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../backend/src/modules/auth/auth.middleware.ts";
import {
  businessService,
  CreateBusinessDto,
  UpdateBusinessDto,
} from "../../../../backend/src/modules/business/index.ts";

/**
 * POST /api/v1/business
 * Creates a new business and assigns the authenticated caller as OWNER.
 */
export async function POST(req: Request) {
  try {
    const { user } = await authenticateRequest(req);

    let body: CreateBusinessDto;
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

    const result = await businessService.createBusiness(user, body);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const formatted = businessService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * GET /api/v1/business
 * Returns the business associated with the authenticated user.
 */
export async function GET(req: Request) {
  try {
    const { user } = await authenticateRequest(req);

    const result = await businessService.getBusinessForUser(user);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BUSINESS_NOT_FOUND",
            message: "User does not belong to any active service business.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = businessService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * PATCH /api/v1/business
 * Updates business profile details. Authorized for OWNER only.
 */
export async function PATCH(req: Request) {
  try {
    const { user } = await authenticateRequest(req);

    let body: UpdateBusinessDto;
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

    const updatedBusiness = await businessService.updateBusiness(user, body);

    return NextResponse.json(
      {
        success: true,
        data: updatedBusiness,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = businessService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
