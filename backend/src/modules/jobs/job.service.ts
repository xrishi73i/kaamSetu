import { IJobRepository, jobRepository } from "./job.repository";
import {
  Job,
  CreateJobDto,
  UpdateJobDto,
  AssignJobDto,
  CancelJobDto,
  JobErrorCode,
} from "./job.types";
import {
  validateCreateJob,
  validateUpdateJob,
  validateAssignJob,
  validateCancelJob,
} from "./job.validation";
import { BusinessMember } from "../members/member.types";
import {
  ICustomerRepository,
  customerRepository,
} from "../customers/customer.repository";
import {
  IServiceRepository,
  serviceRepository,
} from "../services/service.repository";
import {
  IMemberRepository,
  memberRepository,
} from "../members/member.repository";

// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

export class JobError extends Error {
  public code: JobErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: JobErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class JobService {
  constructor(
    private jobRepo: IJobRepository = jobRepository,
    private customerRepo: ICustomerRepository = customerRepository,
    private serviceRepo: IServiceRepository = serviceRepository,
    private memberRepo: IMemberRepository = memberRepository
  ) {}

  /**
   * Creates a new Job under the caller's business.
   * Validates that both the Customer and Service exist and belong to the same business.
   * Authorized for OWNER and MANAGER roles.
   */
  public async createJob(
    caller: BusinessMember,
    dto: CreateJobDto
  ): Promise<Job> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new JobError(
        "Only business Owners and Managers are authorized to create jobs.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Input validation
    const validation = validateCreateJob(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new JobError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Customer existence and same-business check
    const customer = await this.customerRepo.findById(
      caller.businessId,
      dto.customerId
    );
    if (!customer) {
      throw new JobError(
        "Referenced customer not found in this business.",
        "CUSTOMER_NOT_FOUND",
        404
      );
    }

    // 4. Service existence and same-business check
    const service = await this.serviceRepo.findById(
      caller.businessId,
      dto.serviceId
    );
    if (!service) {
      throw new JobError(
        "Referenced service not found in this business.",
        "SERVICE_NOT_FOUND",
        404
      );
    }

    // 5. Optional technician assignment check on creation
    let initialStatus: Job["status"] = "CREATED";
    if (dto.technicianId) {
      const tech = await this.memberRepo.findById(dto.technicianId);
      if (
        !tech ||
        tech.businessId !== caller.businessId ||
        tech.status === "INACTIVE"
      ) {
        throw new JobError(
          "Referenced technician not found in this business or is inactive.",
          "MEMBER_NOT_FOUND",
          404
        );
      }
      initialStatus = "ASSIGNED";
    }

    // 6. Create Job strictly scoped to caller's business
    return this.jobRepo.create({
      ...dto,
      businessId: caller.businessId,
      status: initialStatus,
    });
  }

  /**
   * Lists all Jobs for the caller's business.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async listJobs(businessId: string): Promise<Job[]> {
    return this.jobRepo.findByBusinessId(businessId);
  }

  /**
   * Retrieves a single Job by ID within the caller's business.
   * Accessible by all active members of the business (OWNER, MANAGER, TECHNICIAN).
   */
  public async getJob(businessId: string, id: string): Promise<Job> {
    const job = await this.jobRepo.findById(businessId, id);
    if (!job) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }
    return job;
  }

  /**
   * Updates editable job fields (title, description).
   * Authorized for OWNER and MANAGER roles.
   */
  public async updateJob(
    caller: BusinessMember,
    id: string,
    dto: UpdateJobDto
  ): Promise<Job> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new JobError(
        "Only business Owners and Managers are authorized to update jobs.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validation
    const validation = validateUpdateJob(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new JobError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Check existing job
    const existing = await this.jobRepo.findById(caller.businessId, id);
    if (!existing) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new JobError(
        `Cannot modify a ${existing.status.toLowerCase()} job.`,
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    const updated = await this.jobRepo.update(caller.businessId, id, {
      title: dto.title,
      description: dto.description,
    });

    if (!updated) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Assigns a technician to a Job and transitions status to ASSIGNED.
   * Authorized for OWNER and MANAGER roles.
   */
  public async assignJob(
    caller: BusinessMember,
    id: string,
    dto: AssignJobDto
  ): Promise<Job> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new JobError(
        "Only business Owners and Managers are authorized to assign technicians.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validation
    const validation = validateAssignJob(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new JobError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Check existing job
    const existing = await this.jobRepo.findById(caller.businessId, id);
    if (!existing) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new JobError(
        `Cannot assign a ${existing.status.toLowerCase()} job.`,
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    // 4. Verify technician exists in same business and is active
    const tech = await this.memberRepo.findById(dto.technicianId);
    if (
      !tech ||
      tech.businessId !== caller.businessId ||
      tech.status === "INACTIVE"
    ) {
      throw new JobError(
        "Technician not found in this business or is inactive.",
        "MEMBER_NOT_FOUND",
        404
      );
    }

    // 5. Update job with assigned technician
    const nextStatus =
      existing.status === "IN_PROGRESS" ? "IN_PROGRESS" : "ASSIGNED";
    const updated = await this.jobRepo.update(caller.businessId, id, {
      technicianId: tech.id,
      status: nextStatus,
    });

    if (!updated) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Starts work on a job and transitions status from ASSIGNED to IN_PROGRESS.
   * Authorized for OWNER, MANAGER, or the specific assigned TECHNICIAN.
   */
  public async startJob(caller: BusinessMember, id: string): Promise<Job> {
    const existing = await this.jobRepo.findById(caller.businessId, id);
    if (!existing) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    // State machine check
    if (existing.status !== "ASSIGNED") {
      throw new JobError(
        `Job cannot be started. It must be in ASSIGNED status (current status: ${existing.status}).`,
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    // Role check: If technician, must be the assigned technician
    if (caller.role === "TECHNICIAN") {
      if (existing.technicianId !== caller.id) {
        throw new JobError(
          "You are not authorized to start a job assigned to another technician.",
          "FORBIDDEN",
          403
        );
      }
    }

    const updated = await this.jobRepo.update(caller.businessId, id, {
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Completes a job and transitions status from IN_PROGRESS to COMPLETED.
   * Authorized for OWNER, MANAGER, or the specific assigned TECHNICIAN.
   */
  public async completeJob(caller: BusinessMember, id: string): Promise<Job> {
    const existing = await this.jobRepo.findById(caller.businessId, id);
    if (!existing) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    // State machine check
    if (existing.status !== "IN_PROGRESS") {
      throw new JobError(
        `Job cannot be completed. It must be in IN_PROGRESS status (current status: ${existing.status}).`,
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    // Role check: If technician, must be the assigned technician
    if (caller.role === "TECHNICIAN") {
      if (existing.technicianId !== caller.id) {
        throw new JobError(
          "You are not authorized to complete a job assigned to another technician.",
          "FORBIDDEN",
          403
        );
      }
    }

    const updated = await this.jobRepo.update(caller.businessId, id, {
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    });

    if (!updated) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    // ============================================================
    // AUTOMATION HANDOFF — PARAKRAM
    // EVENT: JOB_COMPLETED
    // ============================================================
    //
    // The Jobs module owns the business state transition.
    // Future automation may consume a JOB_COMPLETED event for:
    // - customer follow-up
    // - notification
    // - post-service workflow
    //
    // Do not place automation implementation inside the Jobs domain.
    // ============================================================

    return updated;
  }

  /**
   * Cancels a job from CREATED, ASSIGNED, or IN_PROGRESS.
   * Authorized for OWNER and MANAGER roles.
   */
  public async cancelJob(
    caller: BusinessMember,
    id: string,
    dto: CancelJobDto
  ): Promise<Job> {
    // 1. Authorization check
    if (caller.role !== "OWNER" && caller.role !== "MANAGER") {
      throw new JobError(
        "Only business Owners and Managers are authorized to cancel jobs.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validation
    const validation = validateCancelJob(dto);
    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new JobError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    // 3. Check existing job
    const existing = await this.jobRepo.findById(caller.businessId, id);
    if (!existing) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    // Terminal states cannot be cancelled
    if (existing.status === "COMPLETED") {
      throw new JobError(
        "Cannot cancel an already completed job.",
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    if (existing.status === "CANCELLED") {
      throw new JobError(
        "Job is already cancelled.",
        "INVALID_STATE_TRANSITION",
        400
      );
    }

    const updated = await this.jobRepo.update(caller.businessId, id, {
      status: "CANCELLED",
      cancelledAt: new Date().toISOString(),
      cancellationReason: dto.reason?.trim() || undefined,
    });

    if (!updated) {
      throw new JobError("Job not found.", "JOB_NOT_FOUND", 404);
    }

    return updated;
  }

  /**
   * Standardizes error responses into HTTP status and body envelopes.
   */
  public formatError(err: unknown) {
    if (err instanceof JobError) {
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

const globalForJobsService = globalThis as unknown as {
  jobService?: JobService;
};

export const jobService =
  globalForJobsService.jobService || new JobService();

if (process.env.NODE_ENV !== "production") {
  globalForJobsService.jobService = jobService;
}
