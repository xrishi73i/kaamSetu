import { authenticateRequest } from "../auth/auth.middleware";
import { AuthUser } from "../auth/auth.types";
import { memberService, MemberError } from "./member.service";
import { BusinessMember, BusinessMemberRole } from "./member.types";

export interface BusinessMemberContext {
  user: AuthUser;
  member: BusinessMember;
  businessId: string;
}

/**
 * Server-side guard to verify that the requesting user belongs to a business
 * and holds an active membership with appropriate role permissions.
 */
export async function requireBusinessMember(
  req: Request,
  allowedRoles?: BusinessMemberRole[]
): Promise<BusinessMemberContext> {
  // 1. Authenticate user identity (Level 1)
  const { user } = await authenticateRequest(req);

  // 2. Fetch membership
  const member = await memberService.getMembershipByUserId(user.id);
  if (!member) {
    throw new MemberError(
      "User does not belong to any service business.",
      "FORBIDDEN",
      403
    );
  }

  // 3. Ensure membership is active
  if (member.status === "INACTIVE") {
    throw new MemberError(
      "Your membership in this business has been deactivated.",
      "FORBIDDEN",
      403
    );
  }

  // 4. Role check if specified
  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw new MemberError(
      `Access denied. Requires one of the following roles: ${allowedRoles.join(", ")}.`,
      "FORBIDDEN",
      403
    );
  }

  return {
    user,
    member,
    businessId: member.businessId,
  };
}
