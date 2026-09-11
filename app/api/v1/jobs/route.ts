import { NextResponse } from "next/server";
import { requireBusinessMember } from "../../../../backend/src/modules/members/index.ts";
import {
  jobService,
  CreateJobDto,
} from "../../../../backend/src/modules/jobs/index.ts";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

/**
 * GET /api/v1/jobs
 * Lists all jobs belonging to the caller's business.
 * Authorized for all active members (OWNER, MANAGER, TECHNICIAN).
 */
export async function GET(req: Request) {
  try {
    const { businessId } = await requireBusinessMember(req);
    const jobs = await jobService.listJobs(businessId);

    return NextResponse.json(
      {
        success: true,
        data: jobs,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = jobService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * POST /api/v1/jobs
 * Creates a new job under the caller's business.
 * Authorized for OWNER and MANAGER roles.
 */
export async function POST(req: Request) {
  try {
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: CreateJobDto;
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

    const job = await jobService.createJob(member, body);

    return NextResponse.json(
      {
        success: true,
        data: job,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const formatted = jobService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
