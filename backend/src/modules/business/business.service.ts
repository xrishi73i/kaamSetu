import { IBusinessRepository, businessRepository } from "./business.repository";
import {
  Business,
  CreateBusinessDto,
  UpdateBusinessDto,
  BusinessErrorCode,
} from "./business.types";
import {
  validateCreateBusiness,
  validateUpdateBusiness,
} from "./business.validation";
import { memberService } from "../members/member.service";
import { BusinessMember } from "../members/member.types";
import { AuthUser } from "../auth/auth.types";

export class BusinessError extends Error {
  public code: BusinessErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: BusinessErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class BusinessService {
  constructor(private repo: IBusinessRepository = businessRepository) {}

  /**
   * Creates a new business and establishes the authenticated user as OWNER.
   */
  public async createBusiness(
    user: AuthUser,
    dto: CreateBusinessDto
  ): Promise<{ business: Business; member: BusinessMember }> {
    // 1. Check if user already owns or belongs to an active business
    const existingMembership = await memberService.getMembershipByUserId(user.id);
    if (existingMembership && existingMembership.status !== "INACTIVE") {
      throw new BusinessError(
        "User is already registered with an active service business.",
        "BUSINESS_ALREADY_EXISTS",
        409
      );
    }

    // 2. Validate input
    const validation = validateCreateBusiness(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new BusinessError(firstErrorMessage, "VALIDATION_ERROR", 400, validation.errors);
    }

    // 3. Create Business
    const business = await this.repo.create(dto);

    // 4. Create BusinessMember with OWNER role
    const member = await memberService.createOwnerMember(business.id, user);

    return { business, member };
  }

  /**
   * Retrieves the business associated with the authenticated user.
   */
  public async getBusinessForUser(
    user: AuthUser
  ): Promise<{ business: Business; member: BusinessMember } | null> {
    const membership = await memberService.getMembershipByUserId(user.id);
    if (!membership || membership.status === "INACTIVE") {
      return null;
    }

    const business = await this.repo.findById(membership.businessId);
    if (!business) {
      return null;
    }

    return { business, member: membership };
  }

  /**
   * Updates business profile details. Only authorized for OWNER.
   */
  public async updateBusiness(
    user: AuthUser,
    dto: UpdateBusinessDto
  ): Promise<Business> {
    const membership = await memberService.getMembershipByUserId(user.id);
    if (!membership || membership.status === "INACTIVE") {
      throw new BusinessError(
        "User does not belong to any active service business.",
        "BUSINESS_NOT_FOUND",
        404
      );
    }

    if (membership.role !== "OWNER") {
      throw new BusinessError(
        "Only business Owners can update business profile details.",
        "FORBIDDEN",
        403
      );
    }

    const validation = validateUpdateBusiness(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new BusinessError(firstErrorMessage, "VALIDATION_ERROR", 400, validation.errors);
    }

    return this.repo.update(membership.businessId, dto);
  }

  /**
   * Formats errors for standard API response
   */
  public formatError(err: unknown) {
    if (err instanceof BusinessError) {
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

const globalForBizService = globalThis as unknown as { businessService?: BusinessService };

export const businessService =
  globalForBizService.businessService || new BusinessService();

if (process.env.NODE_ENV !== "production") {
  globalForBizService.businessService = businessService;
}
