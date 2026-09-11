import {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
} from "@/backend/src/modules/customers/customer.types";
import { ApiResponse } from "@/backend/src/modules/auth/auth.types";

export interface CustomerClientError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: CustomerClientError | null }> {
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

export const customerClient = {
  async createCustomer(dto: CreateCustomerDto) {
    return request<Customer>("/api/v1/customers", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async listCustomers() {
    return request<Customer[]>("/api/v1/customers", {
      method: "GET",
    });
  },

  async getCustomer(id: string) {
    return request<Customer>(`/api/v1/customers/${id}`, {
      method: "GET",
    });
  },

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    return request<Customer>(`/api/v1/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },

  async deleteCustomer(id: string) {
    return request<{ id: string; deleted: boolean }>(`/api/v1/customers/${id}`, {
      method: "DELETE",
    });
  },
};
