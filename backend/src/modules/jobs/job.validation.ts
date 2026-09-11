import {
  CreateJobDto,
  UpdateJobDto,
  AssignJobDto,
  CancelJobDto,
} from "./job.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export function validateCreateJob(dto: CreateJobDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Customer ID validation
  if (!dto.customerId || typeof dto.customerId !== "string" || dto.customerId.trim().length === 0) {
    errors.customerId = ["Customer ID is required."];
  }

  // Service ID validation
  if (!dto.serviceId || typeof dto.serviceId !== "string" || dto.serviceId.trim().length === 0) {
    errors.serviceId = ["Service ID is required."];
  }

  // Title validation
  if (!dto.title || typeof dto.title !== "string" || dto.title.trim().length === 0) {
    errors.title = ["Job title is required."];
  } else if (dto.title.trim().length < 2) {
    errors.title = ["Job title must be at least 2 characters."];
  } else if (dto.title.trim().length > 100) {
    errors.title = ["Job title cannot exceed 100 characters."];
  }

  // Description validation (optional)
  if (dto.description !== undefined && dto.description !== null) {
    if (typeof dto.description !== "string") {
      errors.description = ["Job description must be a string."];
    } else if (dto.description.trim().length > 1000) {
      errors.description = ["Job description cannot exceed 1000 characters."];
    }
  }

  // Technician ID validation (optional)
  if (dto.technicianId !== undefined && dto.technicianId !== null) {
    if (typeof dto.technicianId !== "string" || dto.technicianId.trim().length === 0) {
      errors.technicianId = ["Technician ID must be a non-empty string if provided."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateJob(dto: UpdateJobDto): ValidationResult {
  const errors: Record<string, string[]> = {};
  const rawDto = dto as Record<string, unknown>;

  // Reject protected fields
  if (rawDto.businessId !== undefined) {
    errors.businessId = ["businessId is a protected tenant field and cannot be updated."];
  }

  if (rawDto.id !== undefined) {
    errors.id = ["id is a protected field and cannot be updated."];
  }

  if (rawDto.customerId !== undefined) {
    errors.customerId = ["customerId cannot be modified after job creation."];
  }

  if (rawDto.serviceId !== undefined) {
    errors.serviceId = ["serviceId cannot be modified after job creation."];
  }

  if (rawDto.status !== undefined) {
    errors.status = ["status must be modified via lifecycle transition endpoints (assign, start, complete, cancel)."];
  }

  const hasTitle = dto.title !== undefined;
  const hasDescription = dto.description !== undefined;

  if (!hasTitle && !hasDescription && Object.keys(errors).length === 0) {
    errors.general = ["At least one field (title, description) must be provided to update."];
  }

  if (hasTitle) {
    if (typeof dto.title !== "string" || dto.title.trim().length < 2) {
      errors.title = ["Job title must be at least 2 characters."];
    } else if (dto.title.trim().length > 100) {
      errors.title = ["Job title cannot exceed 100 characters."];
    }
  }

  if (hasDescription && dto.description !== null && dto.description !== "") {
    if (typeof dto.description !== "string") {
      errors.description = ["Job description must be a string."];
    } else if (dto.description.trim().length > 1000) {
      errors.description = ["Job description cannot exceed 1000 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAssignJob(dto: AssignJobDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.technicianId || typeof dto.technicianId !== "string" || dto.technicianId.trim().length === 0) {
    errors.technicianId = ["Technician ID is required."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateCancelJob(dto: CancelJobDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (dto.reason !== undefined && dto.reason !== null) {
    if (typeof dto.reason !== "string") {
      errors.reason = ["Cancellation reason must be a string."];
    } else if (dto.reason.trim().length > 500) {
      errors.reason = ["Cancellation reason cannot exceed 500 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
