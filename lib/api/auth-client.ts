import {
  AuthUser,
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
  ApiResponse,
} from "@/backend/src/modules/auth/auth.types";

export interface AuthClientError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: AuthClientError | null }> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // Ensures HttpOnly cookies are attached
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

export const authClient = {
  async signUp(dto: SignUpDto) {
    return request<{ user: AuthUser; token: string }>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async signIn(dto: SignInDto) {
    return request<{ user: AuthUser; token: string }>("/api/v1/auth/signin", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async signOut() {
    return request<{ message: string }>("/api/v1/auth/logout", {
      method: "POST",
    });
  },

  async getMe() {
    return request<AuthUser>("/api/v1/auth/me", {
      method: "GET",
    });
  },

  async forgotPassword(dto: ForgotPasswordDto) {
    return request<{ message: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(dto),
    });
  },

  async testProtectedEndpoint() {
    return request<{ message: string; authenticatedUser: Partial<AuthUser> }>(
      "/api/v1/test/protected",
      {
        method: "GET",
      }
    );
  },
};
