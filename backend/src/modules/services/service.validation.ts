import { CreateServiceDto, UpdateServiceDto } from "./service.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

export function validateCreateService(dto: CreateServiceDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Name validation
  if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
    errors.name = ["Service name is required."];
  } else if (dto.name.trim().length < 2) {
    errors.name = ["Service name must be at least 2 characters."];
  } else if (dto.name.trim().length > 100) {
    errors.name = ["Service name cannot exceed 100 characters."];
  }

  // Price validation (must be integer in minor units / paise)
  if (dto.price === undefined || dto.price === null || typeof dto.price !== "number" || isNaN(dto.price)) {
    errors.price = ["Service price is required and must be a valid number in minor units (paise)."];
  } else if (!Number.isInteger(dto.price)) {
    errors.price = [
      "Price must be an integer represented in minor units (paise). Floating-point values are not allowed. For example, ₹500 should be provided as 50000 paise.",
    ];
  } else if (dto.price < 0) {
    errors.price = ["Service price cannot be negative."];
  }

  // Description validation (optional)
  if (dto.description !== undefined && dto.description !== null) {
    if (typeof dto.description !== "string") {
      errors.description = ["Service description must be a string."];
    } else if (dto.description.trim().length > 500) {
      errors.description = ["Service description cannot exceed 500 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateService(dto: UpdateServiceDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  const rawDto = dto as Record<string, unknown>;

  // Reject protected fields if client attempts to alter them
  if (rawDto.businessId !== undefined) {
    errors.businessId = ["businessId is a protected tenant field and cannot be updated."];
  }

  if (rawDto.id !== undefined) {
    errors.id = ["id is a protected field and cannot be updated."];
  }

  const hasName = dto.name !== undefined;
  const hasDescription = dto.description !== undefined;
  const hasPrice = dto.price !== undefined;

  if (!hasName && !hasDescription && !hasPrice && Object.keys(errors).length === 0) {
    errors.general = ["At least one field (name, description, price) must be provided to update."];
  }

  if (hasName) {
    if (typeof dto.name !== "string" || dto.name.trim().length < 2) {
      errors.name = ["Service name must be at least 2 characters."];
    } else if (dto.name.trim().length > 100) {
      errors.name = ["Service name cannot exceed 100 characters."];
    }
  }

  if (hasPrice) {
    if (typeof dto.price !== "number" || isNaN(dto.price)) {
      errors.price = ["Service price must be a valid number."];
    } else if (!Number.isInteger(dto.price)) {
      errors.price = [
        "Price must be an integer represented in minor units (paise). Floating-point values are not allowed.",
      ];
    } else if (dto.price < 0) {
      errors.price = ["Service price cannot be negative."];
    }
  }

  if (hasDescription && dto.description !== null && dto.description !== "") {
    if (typeof dto.description !== "string") {
      errors.description = ["Service description must be a string."];
    } else if (dto.description.trim().length > 500) {
      errors.description = ["Service description cannot exceed 500 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
