/**
 * KaamSetu Level 2 - Business Member Types
 * 
 * Defines roles, statuses, membership models, and DTOs for business members.
 */

export type BusinessMemberRole = "OWNER" | "MANAGER" | "TECHNICIAN";

export type BusinessMemberStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export interface BusinessMember {
  id: string;
  businessId: string;
  userId: string;
  role: BusinessMemberRole;
  status: BusinessMemberStatus;
  joinedAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export interface InviteMemberDto {
  name: string;
  email: string;
  phone: string;
  role: BusinessMemberRole;
}

export interface UpdateMemberDto {
  role?: BusinessMemberRole;
  status?: BusinessMemberStatus;
}

export type MemberErrorCode =
  | "MEMBER_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "CANNOT_DEMOTE_SOLE_OWNER"
  | "CANNOT_DEACTIVATE_SELF"
  | "INTERNAL_SERVER_ERROR";
