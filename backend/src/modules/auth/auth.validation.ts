import { SignUpDto, SignInDto, ForgotPasswordDto } from "./auth.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Indian mobile number: 10 digits starting with 6, 7, 8, or 9, optional +91 or 0 prefix
const PHONE_REGEX = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;

export function normalizePhone(phone: string): string {
  // Strip non-digits, and if 12 digits starting with 91, keep last 10
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

export function validateSignUp(dto: SignUpDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  // Name validation
  if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
    errors.name = ["Name is required."];
  } else if (dto.name.trim().length < 2) {
    errors.name = ["Name must be at least 2 characters."];
  }

  // Email validation
  if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
    errors.email = ["Email is required."];
  } else if (!EMAIL_REGEX.test(dto.email.trim())) {
    errors.email = ["Please provide a valid email address."];
  }

  // Phone validation
  if (!dto.phone || typeof dto.phone !== "string" || dto.phone.trim().length === 0) {
    errors.phone = ["Phone number is required."];
  } else {
    const trimmedPhone = dto.phone.trim();
    if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = ["Please provide a valid 10-digit Indian phone number."];
    }
  }

  // Password validation
  if (!dto.password || typeof dto.password !== "string") {
    errors.password = ["Password is required."];
  } else if (dto.password.length < 8) {
    errors.password = ["Password must be at least 8 characters long."];
  }

  // Confirm password validation
  if (dto.confirmPassword !== undefined) {
    if (dto.password !== dto.confirmPassword) {
      errors.confirmPassword = ["Passwords do not match."];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateSignIn(dto: SignInDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
    errors.email = ["Email is required."];
  } else if (!EMAIL_REGEX.test(dto.email.trim())) {
    errors.email = ["Please provide a valid email address."];
  }

  if (!dto.password || typeof dto.password !== "string" || dto.password.length === 0) {
    errors.password = ["Password is required."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateForgotPassword(dto: ForgotPasswordDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
    errors.email = ["Email is required."];
  } else if (!EMAIL_REGEX.test(dto.email.trim())) {
    errors.email = ["Please provide a valid email address."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
