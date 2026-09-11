import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../../../backend/src/modules/members/index.ts";
import { jobService } from "../../../../../../backend/src/modules/jobs/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

/**
 * POST /api/v1/jobs/[id]/start
 * Starts work on a job and transitions status from ASSIGNED to IN_PROGRESS.
 * Authorized for OWNER, MANAGER, or the assigned TECHNICIAN.
 */
export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req);

    const updated = await jobService.startJob(member, id);

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
