import {
  ServiceOffering,
  CreateServiceDto,
  UpdateServiceDto,
} from "@/backend/src/modules/services/service.types";
import { ApiResponse } from "@/backend/src/modules/auth/auth.types";

export interface ServiceClientError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: ServiceClientError | null }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: {
        code: "PARSE_ERROR",
        message: "Failed to parse server response.",
      },
    }));

    if (!json.success) {
      return {
        data: null,
        error: {
          code: json.error.code || "UNKNOWN_ERROR",
          message: json.error.message || "An unexpected error occurred.",
          details: json.error.details,
        },
      };
    }

    return { data: json.data, error: null };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Network error. Please check your connection.";
    return {
      data: null,
      error: {
        code: "NETWORK_ERROR",
        message,
      },
    };
  }
}

export const serviceClient = {
  async createService(dto: CreateServiceDto) {
    return request<ServiceOffering>("/api/v1/services", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async listServices() {
    return request<ServiceOffering[]>("/api/v1/services", {
      method: "GET",
    });
  },

  async getService(id: string) {
    return request<ServiceOffering>(`/api/v1/services/${id}`, {
      method: "GET",
    });
  },

  async updateService(id: string, dto: UpdateServiceDto) {
    return request<ServiceOffering>(`/api/v1/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },

  async deleteService(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/v1/services/${id}`, {
      method: "DELETE",
    });
  },
};
