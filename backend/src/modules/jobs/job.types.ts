// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the jobs API contract without coordination.
// ============================================================

export type JobStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Job {
  id: string; // Prefix: job_
  businessId: string; // Tenant partition key
  customerId: string; // Validated customer in same business
  serviceId: string; // Validated service in same business
  technicianId?: string; // Assigned technician (BusinessMember ID)
  title: string; // Brief descriptive title
  description?: string; // Detailed instructions or problem description
  status: JobStatus; // Current lifecycle state
  startedAt?: string; // ISO 8601 when work began
  completedAt?: string; // ISO 8601 when work was finished
  cancelledAt?: string; // ISO 8601 if cancelled
  cancellationReason?: string; // Optional reason for cancellation
  createdAt: string; // ISO 8601 creation timestamp
  updatedAt: string; // ISO 8601 update timestamp
}

export interface CreateJobDto {
  customerId: string;
  serviceId: string;
  title: string;
  description?: string;
  technicianId?: string; // Optional initial assignment
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  businessId?: never; // Protected
  id?: never; // Protected
  customerId?: never; // Protected
  serviceId?: never; // Protected
  status?: never; // Protected (managed by transition endpoints)
}

export interface AssignJobDto {
  technicianId: string;
}

export interface CancelJobDto {
  reason?: string;
}

export type JobErrorCode =
  | "VALIDATION_ERROR"
  | "JOB_NOT_FOUND"
  | "CUSTOMER_NOT_FOUND"
  | "SERVICE_NOT_FOUND"
  | "MEMBER_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR";
