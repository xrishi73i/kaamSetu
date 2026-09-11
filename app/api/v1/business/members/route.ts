import { NextResponse } from "next/server";
import {
  requireBusinessMember,
  memberService,
  InviteMemberDto,
} from "../../../../../backend/src/modules/members/index.ts";

/**
 * GET /api/v1/business/members
 * Lists all members belonging to the caller's business.
 */
export async function GET(req: Request) {
  try {
    const { businessId } = await requireBusinessMember(req);
    const members = await memberService.listMembersByBusiness(businessId);

    return NextResponse.json(
      {
        success: true,
        data: members,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = memberService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

/**
 * POST /api/v1/business/members
 * Invites or registers a new member in the business. Authorized for OWNER and MANAGER.
 */
export async function POST(req: Request) {
  try {
    const { member } = await requireBusinessMember(req, ["OWNER", "MANAGER"]);

    let body: InviteMemberDto;
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

    const newMember = await memberService.inviteMember(member, body);

    return NextResponse.json(
      {
        success: true,
        data: newMember,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const formatted = memberService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
