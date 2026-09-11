import { IServiceRepository, serviceRepository } from "./service.repository";
import {
  ServiceOffering,
  CreateServiceDto,
  UpdateServiceDto,
  ServiceErrorCode,
} from "./service.types";
import {
  validateCreateService,
  validateUpdateService,
} from "./service.validation";
import { BusinessMember } from "../members/member.types";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the services API contract without coordination.
// ============================================================

export class ServiceError extends Error {
  public code: ServiceErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: ServiceErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * ServiceCatalogService coordinates domain logic for catalog service offerings.
 * Naming note: Named ServiceCatalogService to avoid confusion with the generic application service layer.
 */
export class ServiceCatalogService {
  constructor(private repo: IServiceRepository = serviceRepository) {}

  /**
   * Creates a new service offering strictly under the caller's business.
   * Authorized for OWNER and MANAGER roles.
   */
  public async createService(
    caller: BusinessMember,
    dto: CreateServiceDto
  ): Promise<ServiceOffering> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new ServiceError(
        "Only business Owners and Managers are authorized to create services.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Input validation
    const validation = validateCreateService(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new ServiceError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Persist scoped to caller's business
    return this.repo.create({
      ...dto,
      businessId: caller.businessId,
    });
  }

  /**
   * Lists all service offerings for the specified business.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async listServices(businessId: string): Promise<ServiceOffering[]> {
    return this.repo.findByBusinessId(businessId);
  }

  /**
   * Retrieves a single service offering by ID, enforcing tenant isolation.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async getService(
    businessId: string,
    id: string
  ): Promise<ServiceOffering> {
    const service = await this.repo.findById(businessId, id);
    if (!service) {
      throw new ServiceError("Service not found.", "SERVICE_NOT_FOUND", 404);
    }
    return service;
  }

  /**
   * Updates an existing service offering.
   * Authorized for OWNER and MANAGER roles. Enforces tenant isolation.
   */
  public async updateService(
    caller: BusinessMember,
    id: string,
    dto: UpdateServiceDto
  ): Promise<ServiceOffering> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new ServiceError(
        "Only business Owners and Managers are authorized to update services.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Input validation
    const validation = validateUpdateService(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new ServiceError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Update scoped by caller.businessId + id
    const updated = await this.repo.update(caller.businessId, id, dto);
    if (!updated) {
      throw new ServiceError("Service not found.", "SERVICE_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Deletes a service offering.
   * Authorized for OWNER and MANAGER roles. Enforces tenant isolation.
   */
  public async deleteService(
    caller: BusinessMember,
    id: string
  ): Promise<{ id: string; deleted: true }> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new ServiceError(
        "Only business Owners and Managers are authorized to delete services.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Delete scoped by caller.businessId + id
    const success = await this.repo.delete(caller.businessId, id);
    if (!success) {
      throw new ServiceError("Service not found.", "SERVICE_NOT_FOUND", 404);
    }

    return { id, deleted: true };
  }

  /**
   * Standardizes error responses into HTTP status and body envelopes.
   */
  public formatError(err: unknown) {
    if (err instanceof ServiceError) {
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

    // Handle MemberError, AuthError, or other typed errors with status and code
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

    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
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

const globalForServiceCatalog = globalThis as unknown as {
  serviceCatalogService?: ServiceCatalogService;
};

export const serviceCatalogService =
  globalForServiceCatalog.serviceCatalogService || new ServiceCatalogService();

export const servicesService = serviceCatalogService;

if (process.env.NODE_ENV !== "production") {
  globalForServiceCatalog.serviceCatalogService = serviceCatalogService;
}
