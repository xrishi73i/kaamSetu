import { ICustomerRepository, customerRepository } from "./customer.repository";
import {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerErrorCode,
} from "./customer.types";
import {
  validateCreateCustomer,
  validateUpdateCustomer,
} from "./customer.validation";
import { BusinessMember } from "../members/member.types";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the customer API contract without coordination.
// ============================================================

export class CustomerError extends Error {
  public code: CustomerErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: CustomerErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "CustomerError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class CustomerService {
  constructor(private repo: ICustomerRepository = customerRepository) {}

  /**
   * Creates a new customer record strictly belonging to the caller's business.
   * Authorized for OWNER and MANAGER roles.
   */
  public async createCustomer(
    caller: BusinessMember,
    dto: CreateCustomerDto
  ): Promise<Customer> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new CustomerError(
        "Only business Owners and Managers are authorized to create customers.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Input validation
    const validation = validateCreateCustomer(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new CustomerError(
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
   * Lists all customers for the specified business.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async listCustomers(businessId: string): Promise<Customer[]> {
    return this.repo.findByBusinessId(businessId);
  }

  /**
   * Retrieves a single customer by ID, enforcing tenant isolation.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async getCustomer(businessId: string, id: string): Promise<Customer> {
    const customer = await this.repo.findById(businessId, id);
    if (!customer) {
      throw new CustomerError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
    }
    return customer;
  }

  /**
   * Updates an existing customer record.
   * Authorized for OWNER and MANAGER roles. Enforces tenant isolation.
   */
  public async updateCustomer(
    caller: BusinessMember,
    id: string,
    dto: UpdateCustomerDto
  ): Promise<Customer> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new CustomerError(
        "Only business Owners and Managers are authorized to update customers.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Input validation
    const validation = validateUpdateCustomer(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new CustomerError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Update customer scoped by tenant businessId + customerId
    const updated = await this.repo.update(caller.businessId, id, dto);
    if (!updated) {
      throw new CustomerError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Deletes a customer record.
   * Authorized for OWNER and MANAGER roles. Enforces tenant isolation.
   */
  public async deleteCustomer(
    caller: BusinessMember,
    id: string
  ): Promise<{ id: string; deleted: true }> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new CustomerError(
        "Only business Owners and Managers are authorized to delete customers.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Delete scoped by tenant businessId + customerId
    const success = await this.repo.delete(caller.businessId, id);
    if (!success) {
      throw new CustomerError("Customer not found.", "CUSTOMER_NOT_FOUND", 404);
    }

    return { id, deleted: true };
  }

  /**
   * Standardizes error responses into HTTP status and body.
   */
  public formatError(err: unknown) {
    if (err instanceof CustomerError) {
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

const globalForCustService = globalThis as unknown as {
  customerService?: CustomerService;
};

export const customerService =
  globalForCustService.customerService || new CustomerService();

if (process.env.NODE_ENV !== "production") {
  globalForCustService.customerService = customerService;
}
