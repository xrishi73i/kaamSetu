import { NextResponse } from "next/server";
import {
  requireBusinessMember,
  memberService,
  UpdateMemberDto,
} from "../../../../../../backend/src/modules/members/index.ts";

/**
 * PATCH /api/v1/business/members/[id]
 * Updates member role or status (ACTIVE / INACTIVE). Authorized for OWNER only.
 */
export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const { member } = await requireBusinessMember(req, ["OWNER"]);

    let body: UpdateMemberDto;
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

    const updated = await memberService.updateMember(member, id, body);

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const formatted = memberService.formatError(err);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
