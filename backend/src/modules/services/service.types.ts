// ============================================================
// AWS HANDOFF — MANISH
// Existing authentication abstraction is intentionally preserved.
// Cognito integration should plug into the existing auth contract.
// Do not change the services API contract without coordination.
// ============================================================

/**
 * ServiceOffering represents a catalog service offered by a local business
 * (e.g. "AC Installation", "AC Jet Servicing", "AC Gas Refill").
 *
 * Money representation:
 * `price` is stored as a non-negative integer in minor units (paise).
 * Example: ₹500 is stored as 50000 paise.
 */
export interface ServiceOffering {
  id: string; // Prefix: srv_
  businessId: string; // Tenant partition key
  name: string; // Service name (e.g. "AC Repair")
  description?: string; // Optional detailed description
  price: number; // Integer in minor units (paise)
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

// Domain alias for convenience
export type Service = ServiceOffering;

export interface CreateServiceDto {
  name: string;
  description?: string;
  price: number; // In minor units (paise)
}

export interface UpdateServiceDto {
  name?: string;
  description?: string;
  price?: number; // In minor units (paise)
  businessId?: never; // Protected field; cannot be modified
  id?: never; // Protected field; cannot be modified
}

export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "SERVICE_NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR";
