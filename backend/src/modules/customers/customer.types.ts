// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the customer API contract without coordination.
// ============================================================

export interface Customer {
  id: string; // Prefix: cust_
  businessId: string; // Tenant partition
  name: string;
  phone: string; // Normalized 10-digit Indian phone number
  email?: string;
  address?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type CustomerErrorCode =
  | "VALIDATION_ERROR"
  | "CUSTOMER_NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHENTICATED"
  | "CUSTOMER_ALREADY_EXISTS"
  | "INTERNAL_SERVER_ERROR";
