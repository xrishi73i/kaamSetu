import {
  Business,
  CreateBusinessDto,
  UpdateBusinessDto,
} from "@/backend/src/modules/business/business.types";
import {
  BusinessMember,
  InviteMemberDto,
  UpdateMemberDto,
} from "@/backend/src/modules/members/member.types";
import { ApiResponse } from "@/backend/src/modules/auth/auth.types";

export interface BusinessClientError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: BusinessClientError | null }> {
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
    const message = err instanceof Error ? err.message : "Network error. Please check your connection.";
    return {
      data: null,
      error: {
        code: "NETWORK_ERROR",
        message,
      },
    };
  }
}

export const businessClient = {
  async createBusiness(dto: CreateBusinessDto) {
    return request<{ business: Business; member: BusinessMember }>("/api/v1/business", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async getBusiness() {
    return request<{ business: Business; member: BusinessMember }>("/api/v1/business", {
      method: "GET",
    });
  },

  async updateBusiness(dto: UpdateBusinessDto) {
    return request<Business>("/api/v1/business", {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },

  async listMembers() {
    return request<BusinessMember[]>("/api/v1/business/members", {
      method: "GET",
    });
  },

  async inviteMember(dto: InviteMemberDto) {
    return request<BusinessMember>("/api/v1/business/members", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async updateMember(memberId: string, dto: UpdateMemberDto) {
    return request<BusinessMember>(`/api/v1/business/members/${memberId}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },
};
