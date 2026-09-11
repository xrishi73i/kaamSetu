import { InviteMemberDto, UpdateMemberDto, BusinessMemberRole, BusinessMemberStatus } from "./member.types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:\+91[\-\s]?|0)?[6-9]\d{9}$/;

const VALID_ROLES: BusinessMemberRole[] = ["OWNER", "MANAGER", "TECHNICIAN"];
const VALID_STATUSES: BusinessMemberStatus[] = ["ACTIVE", "INACTIVE", "INVITED"];

export function validateInviteMember(dto: InviteMemberDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.name || typeof dto.name !== "string" || dto.name.trim().length === 0) {
    errors.name = ["Member name is required."];
  } else if (dto.name.trim().length < 2) {
    errors.name = ["Member name must be at least 2 characters."];
  }

  if (!dto.email || typeof dto.email !== "string" || dto.email.trim().length === 0) {
    errors.email = ["Member email is required."];
  } else if (!EMAIL_REGEX.test(dto.email.trim())) {
    errors.email = ["Please provide a valid email address."];
  }

  if (!dto.phone || typeof dto.phone !== "string" || dto.phone.trim().length === 0) {
    errors.phone = ["Member phone number is required."];
  } else if (!PHONE_REGEX.test(dto.phone.trim())) {
    errors.phone = ["Please provide a valid 10-digit Indian phone number."];
  }

  if (!dto.role || !VALID_ROLES.includes(dto.role)) {
    errors.role = ["Role must be one of: OWNER, MANAGER, TECHNICIAN."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateUpdateMember(dto: UpdateMemberDto): ValidationResult {
  const errors: Record<string, string[]> = {};

  if (!dto.role && !dto.status) {
    errors.general = ["At least one of role or status must be provided to update."];
  }

  if (dto.role !== undefined && !VALID_ROLES.includes(dto.role)) {
    errors.role = ["Role must be one of: OWNER, MANAGER, TECHNICIAN."];
  }

  if (dto.status !== undefined && !VALID_STATUSES.includes(dto.status)) {
    errors.status = ["Status must be one of: ACTIVE, INACTIVE, INVITED."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
