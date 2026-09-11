import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../../backend/src/modules/members/index.ts";
import {
  jobService,
  UpdateJobDto,
} from "../../../../../backend/src/modules/jobs/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

/**
 * GET /api/v1/jobs/[id]
 * Retrieves a single job by ID within the caller's business.
 * Authorized for all active members (OWNER, MANAGER, TECHNICIAN).
 */
export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { businessId } = await requireBusinessMember(req);
    const job = await jobService.getJob(businessId, id);

    return NextResponse.json(
      {
        success: true,
        data: job,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = jobService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * PATCH /api/v1/jobs/[id]
 * Updates editable fields of a job within the caller's business.
 * Authorized for OWNER and MANAGER roles.
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: UpdateJobDto;
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

    const updated = await jobService.updateJob(member, id, body);

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = jobService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
