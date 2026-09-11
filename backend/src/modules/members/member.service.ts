import crypto from "node:crypto";
import { IMemberRepository, memberRepository } from "./member.repository";
import {
  BusinessMember,
  InviteMemberDto,
  UpdateMemberDto,
  MemberErrorCode,
} from "./member.types";
import {
  validateInviteMember,
  validateUpdateMember,
} from "./member.validation";
import { AuthUser } from "../auth/auth.types";
import { normalizePhone } from "../auth/auth.validation";

export class MemberError extends Error {
  public code: MemberErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: MemberErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "MemberError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class MemberService {
  constructor(private repo: IMemberRepository = memberRepository) {}

  /**
   * Registers the initial OWNER member when a business is created.
   */
  public async createOwnerMember(
    businessId: string,
    user: AuthUser
  ): Promise<BusinessMember> {
    return this.repo.create({
      businessId,
      userId: user.id,
      role: "OWNER",
      status: "ACTIVE",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  }

  /**
   * Finds the active membership for a given user ID.
   */
  public async getMembershipByUserId(userId: string): Promise<BusinessMember | null> {
    return this.repo.findByUserId(userId);
  }

  /**
   * Lists all members of a specific business.
   */
  public async listMembersByBusiness(businessId: string): Promise<BusinessMember[]> {
    return this.repo.findByBusinessId(businessId);
  }

  /**
   * Invites or adds a new member to the business.
   */
  public async inviteMember(
    caller: BusinessMember,
    dto: InviteMemberDto
  ): Promise<BusinessMember> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new MemberError(
        "Only business Owners and Managers can invite new members.",
        "FORBIDDEN",
        403
      );
    }

    if (caller.role === "MANAGER" && dto.role !== "TECHNICIAN") {
      throw new MemberError(
        "Managers can only invite Technicians.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validation
    const validation = validateInviteMember(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new MemberError(firstErrorMessage, "VALIDATION_ERROR", 400, validation.errors);
    }

    // 3. Duplicate check within business
    const existingMembers = await this.repo.findByBusinessId(caller.businessId);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedPhone = normalizePhone(dto.phone);

    const alreadyInBusiness = existingMembers.some(
      (m) =>
        m.user?.email.toLowerCase() === normalizedEmail ||
        (m.user?.phone && normalizePhone(m.user.phone) === normalizedPhone)
    );

    if (alreadyInBusiness) {
      throw new MemberError(
        "A member with this email or phone number is already part of the business.",
        "MEMBER_ALREADY_EXISTS",
        409
      );
    }

    // 4. Create user stub ID for invited member
    const newUserId = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const newMember = await this.repo.create({
      businessId: caller.businessId,
      userId: newUserId,
      role: dto.role,
      status: "ACTIVE",
      user: {
        id: newUserId,
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
      },
    });

    return newMember;
  }

  /**
   * Modifies an existing member's role or active status.
   */
  public async updateMember(
    caller: BusinessMember,
    memberId: string,
    dto: UpdateMemberDto
  ): Promise<BusinessMember> {
    // 1. Authorization check: Only OWNER can alter roles and statuses
    if (caller.role !== "OWNER") {
      throw new MemberError(
        "Only business Owners can modify member roles and statuses.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validation
    const validation = validateUpdateMember(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new MemberError(firstErrorMessage, "VALIDATION_ERROR", 400, validation.errors);
    }

    // 3. Tenant isolation check: target member must belong to caller's business
    const target = await this.repo.findById(memberId);
    if (!target || target.businessId !== caller.businessId) {
      throw new MemberError("Member not found in this business.", "MEMBER_NOT_FOUND", 404);
    }

    // 4. Safeguard sole owner
    if (target.role === "OWNER" && (dto.role && dto.role !== "OWNER" || dto.status === "INACTIVE")) {
      const allMembers = await this.repo.findByBusinessId(caller.businessId);
      const activeOwners = allMembers.filter((m) => m.role === "OWNER" && m.status === "ACTIVE");
      if (activeOwners.length <= 1) {
        throw new MemberError(
          "Cannot demote or deactivate the sole Owner of the business.",
          "CANNOT_DEMOTE_SOLE_OWNER",
          400
        );
      }
    }

    // 5. Update
    return this.repo.update(memberId, {
      ...(dto.role ? { role: dto.role } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });
  }

  /**
   * Formats errors for standard API response
   */
  public formatError(err: unknown) {
    if (err instanceof MemberError) {
      return {
        status: err.status,
        body: {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          },
        },
      };
    }

    // Handle AuthError or other typed errors with status and code
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number" &&
      "code" in err &&
      typeof (err as { code: unknown }).code === "string"
    ) {
      const typedErr = err as {
        status: number;
        code: string;
        message: string;
        details?: Record<string, string[]>;
      };
      return {
        status: typedErr.status,
        body: {
          success: false,
          error: {
            code: typedErr.code,
            message: typedErr.message || "Request failed.",
            ...(typedErr.details ? { details: typedErr.details } : {}),
          },
        },
      };
    }

    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return {
      status: 500,
      body: {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message,
        },
      },
    };
  }
}

const globalForMemberService = globalThis as unknown as { memberService?: MemberService };

export const memberService =
  globalForMemberService.memberService || new MemberService();

if (process.env.NODE_ENV !== "production") {
  globalForMemberService.memberService = memberService;
}
