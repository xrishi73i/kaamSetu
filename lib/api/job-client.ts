import {
  Job,
  CreateJobDto,
  UpdateJobDto,
} from "@/backend/src/modules/jobs/job.types";
import { ApiResponse } from "@/backend/src/modules/auth/auth.types";

export interface JobClientError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: JobClientError | null }> {
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

export const jobClient = {
  async createJob(dto: CreateJobDto) {
    return request<Job>("/api/v1/jobs", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async listJobs() {
    return request<Job[]>("/api/v1/jobs", {
      method: "GET",
    });
  },

  async getJob(id: string) {
    return request<Job>(`/api/v1/jobs/${id}`, {
      method: "GET",
    });
  },

  async updateJob(id: string, dto: UpdateJobDto) {
    return request<Job>(`/api/v1/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    });
  },

  async assignJob(id: string, technicianId: string) {
    return request<Job>(`/api/v1/jobs/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ technicianId }),
    });
  },

  async startJob(id: string) {
    return request<Job>(`/api/v1/jobs/${id}/start`, {
      method: "POST",
    });
  },

  async completeJob(id: string) {
    return request<Job>(`/api/v1/jobs/${id}/complete`, {
      method: "POST",
    });
  },

  async cancelJob(id: string, reason?: string) {
    return request<Job>(`/api/v1/jobs/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};
