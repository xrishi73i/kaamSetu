import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../backend/src/modules/members/index.ts";
import {
  customerService,
  CreateCustomerDto,
} from "../../../../backend/src/modules/customers/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the customer API contract without coordination.
// ============================================================

/**
 * GET /api/v1/customers
 * Lists all customers belonging to the caller's business.
 * Authorized for all active members (OWNER, MANAGER, TECHNICIAN).
 */
export async function GET(req: Request) {
  try {
    const { businessId } = await requireBusinessMember(req);
    const customers = await customerService.listCustomers(businessId);

    return NextResponse.json(
      {
        success: true,
        data: customers,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = customerService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * POST /api/v1/customers
 * Creates a new customer record under the caller's business.
 * Authorized for OWNER and MANAGER roles.
 */
export async function POST(req: Request) {
  try {
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: CreateCustomerDto;
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

    const customer = await customerService.createCustomer(member, body);

    return NextResponse.json(
      {
        success: true,
        data: customer,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const formatted = customerService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
