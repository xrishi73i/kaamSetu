/**
 * KaamSetu Level 2 - Business Types
 * 
 * Defines core domain models, DTOs, and error codes for Business entities.
 */

export interface Business {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessDto {
  name: string;
  phone: string;
  address: string;
}

export interface UpdateBusinessDto {
  name?: string;
  phone?: string;
  address?: string;
}

export type BusinessErrorCode =
  | "BUSINESS_NOT_FOUND"
  | "BUSINESS_ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "INTERNAL_SERVER_ERROR";
