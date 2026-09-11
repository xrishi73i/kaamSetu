import { CreateCustomerDto, UpdateCustomerDto } from "./customer.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

// Indian mobile number: 10 digits starting with 6, 7, 8, or 9, optional +91 or 0 prefix
const PHONE_REGEX = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function validateCreateCustomer(dto: CreateCustomerDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Name validation
  if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
    errors.name = ["Customer name is required."];
  } else if (dto.name.trim().length < 2) {
    errors.name = ["Customer name must be at least 2 characters."];
  } else if (dto.name.trim().length > 100) {
    errors.name = ["Customer name cannot exceed 100 characters."];
  }

  // Phone validation
  if (!dto.phone || typeof dto.phone !== "string" || dto.phone.trim().length === 0) {
    errors.phone = ["Customer phone number is required."];
  } else {
    const trimmedPhone = dto.phone.trim();
    if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = ["Please provide a valid 10-digit Indian phone number."];
    }
  }

  // Email validation (optional)
  if (dto.email !== undefined && dto.email !== null && dto.email.trim().length > 0) {
    if (!EMAIL_REGEX.test(dto.email.trim())) {
      errors.email = ["Please provide a valid email address."];
    } else if (dto.email.trim().length > 100) {
      errors.email = ["Email cannot exceed 100 characters."];
    }
  }

  // Address validation (optional)
  if (dto.address !== undefined && dto.address !== null && dto.address.trim().length > 0) {
    if (typeof dto.address !== "string") {
      errors.address = ["Address must be a string."];
    } else if (dto.address.trim().length > 250) {
      errors.address = ["Address cannot exceed 250 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateCustomer(dto: UpdateCustomerDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  const hasName = dto.name !== undefined;
  const hasPhone = dto.phone !== undefined;
  const hasEmail = dto.email !== undefined;
  const hasAddress = dto.address !== undefined;

  if (!hasName && !hasPhone && !hasEmail && !hasAddress) {
    errors.general = ["At least one field (name, phone, email, address) must be provided to update."];
  }

  if (hasName) {
    if (typeof dto.name !== "string" || dto.name.trim().length < 2) {
      errors.name = ["Customer name must be at least 2 characters."];
    } else if (dto.name.trim().length > 100) {
      errors.name = ["Customer name cannot exceed 100 characters."];
    }
  }

  if (hasPhone) {
    if (typeof dto.phone !== "string" || !PHONE_REGEX.test(dto.phone.trim())) {
      errors.phone = ["Please provide a valid 10-digit Indian phone number."];
    }
  }

  if (hasEmail && dto.email !== null && dto.email !== "") {
    if (typeof dto.email !== "string" || !EMAIL_REGEX.test(dto.email.trim())) {
      errors.email = ["Please provide a valid email address."];
    } else if (dto.email.trim().length > 100) {
      errors.email = ["Email cannot exceed 100 characters."];
    }
  }

  if (hasAddress && dto.address !== null && dto.address !== "") {
    if (typeof dto.address !== "string") {
      errors.address = ["Address must be a string."];
    } else if (dto.address.trim().length > 250) {
      errors.address = ["Address cannot exceed 250 characters."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
