import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../../../backend/src/modules/members/index.ts";
import {
  jobService,
  AssignJobDto,
} from "../../../../../../backend/src/modules/jobs/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

/**
 * POST /api/v1/jobs/[id]/assign
 * Assigns an active technician to a job and transitions status to ASSIGNED.
 * Authorized for OWNER and MANAGER roles.
 */
export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: AssignJobDto;
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

    const updated = await jobService.assignJob(member, id, body);

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
