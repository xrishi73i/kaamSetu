import { CreateBusinessDto, UpdateBusinessDto } from "./business.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

// Indian mobile number: 10 digits starting with 6, 7, 8, or 9, optional +91 or 0 prefix
const PHONE_REGEX = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

export function validateCreateBusiness(dto: CreateBusinessDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Name validation
  if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
    errors.name = ["Business name is required."];
  } else if (dto.name.trim().length < 2) {
    errors.name = ["Business name must be at least 2 characters."];
  }

  // Phone validation
  if (!dto.phone || typeof dto.phone !== "string" || dto.phone.trim().length === 0) {
    errors.phone = ["Business phone number is required."];
  } else {
    const trimmedPhone = dto.phone.trim();
    if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = ["Please provide a valid 10-digit Indian phone number."];
    }
  }

  // Address validation
  if (!dto.address || typeof dto.address !== "string" || dto.address.trim().length === 0) {
    errors.address = ["Business address is required."];
  } else if (dto.address.trim().length < 3) {
    errors.address = ["Business address must be at least 3 characters."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateBusiness(dto: UpdateBusinessDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.name && !dto.phone && !dto.address) {
    errors.general = ["At least one field (name, phone, address) must be provided to update."];
  }

  if (dto.name !== undefined) {
    if (typeof dto.name !== "string" || dto.name.trim().length < 2) {
      errors.name = ["Business name must be at least 2 characters."];
    }
  }

  if (dto.phone !== undefined) {
    if (typeof dto.phone !== "string" || !PHONE_REGEX.test(dto.phone.trim())) {
      errors.phone = ["Please provide a valid 10-digit Indian phone number."];
    }
  }

  if (dto.address !== undefined) {
    if (typeof dto.address !== "string" || dto.address.trim().length < 3) {
      errors.address = ["Business address must be at least 3 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
