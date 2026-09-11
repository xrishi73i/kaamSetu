/**
 * KaamSetu Level 1 - Authentication Types
 * 
 * Defines core authentication data contracts, DTOs, and response shapes.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  // Future Level authorization context:
  businessId?: string | null;
  role?: "OWNER" | "MANAGER" | "TECHNICIAN" | "CUSTOMER" | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
}

export interface SignUpDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
}

export interface SignInDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "USER_ALREADY_EXISTS"
  | "USER_NOT_FOUND"
  | "UNAUTHORIZED"
  | "SESSION_EXPIRED"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_IMPLEMENTED";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: AuthErrorCode | string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface AuthContext {
  userId: string;
  businessId?: string | null;
  role?: string | null;
}
