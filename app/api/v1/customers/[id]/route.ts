import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../../backend/src/modules/members/index.ts";
import {
  customerService,
  UpdateCustomerDto,
} from "../../../../../backend/src/modules/customers/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the customer API contract without coordination.
// ============================================================

/**
 * GET /api/v1/customers/[id]
 * Retrieves a customer by ID within the caller's business.
 * Authorized for all active members (OWNER, MANAGER, TECHNICIAN).
 */
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { businessId } = await requireBusinessMember(req);
    const customer = await customerService.getCustomer(businessId, id);

    return NextResponse.json(
      {
        success: true,
        data: customer,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = customerService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * PATCH /api/v1/customers/[id]
 * Updates a customer record within the caller's business.
 * Authorized for OWNER and MANAGER roles.
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: UpdateCustomerDto;
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

    const updated = await customerService.updateCustomer(member, id, body);

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = customerService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * DELETE /api/v1/customers/[id]
 * Deletes a customer record within the caller's business.
 * Authorized for OWNER and MANAGER roles.
 */
export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    const result = await customerService.deleteCustomer(member, id);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = customerService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
