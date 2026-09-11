import { IAuthProvider } from "./auth.provider";
import { MockAuthProvider, MockProviderError } from "./mock-auth.provider";
import { CognitoAuthProvider } from "./cognito-auth.provider";
import {
  AuthUser,
  AuthSession,
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
  ApiErrorResponse,
  AuthErrorCode,
} from "./auth.types";
import {
  validateSignUp,
  validateSignIn,
  validateForgotPassword,
} from "./auth.validation";

export class AuthError extends Error {
  public code: AuthErrorCode | string;
  public status: number;
  public details?: Record<string, string[]>;

  constructor(
    message: string,
    code: AuthErrorCode | string = "INTERNAL_SERVER_ERROR",
    status = 400,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * AuthService
 * 
 * Central business logic layer for authentication in KaamSetu.
 * Coordinates input validation, identity provider operations, session orchestration,
 * and data sanitization.
 */
export class AuthService {
  private provider: IAuthProvider;

  constructor(customProvider?: IAuthProvider) {
    if (customProvider) {
      this.provider = customProvider;
    } else {
      const providerType = process.env.AUTH_PROVIDER?.toLowerCase() || "mock";
      if (providerType === "cognito") {
        this.provider = new CognitoAuthProvider();
      } else {
        this.provider = new MockAuthProvider();
      }
    }
  }

  public getProvider(): IAuthProvider {
    return this.provider;
  }

  /**
   * Registers a new user account.
   */
  public async signUp(dto: SignUpDto): Promise<AuthUser> {
    const validation = validateSignUp(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new AuthError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    try {
      const user = await this.provider.signUp(dto);
      return this.sanitizeUser(user);
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      if (err instanceof MockProviderError) {
        throw new AuthError(err.message, err.code, err.status);
      }
      const message = err instanceof Error ? err.message : "Failed to create account.";
      throw new AuthError(message, "USER_ALREADY_EXISTS", 400);
    }
  }

  /**
   * Signs in an existing user and creates a session.
   */
  public async signIn(dto: SignInDto): Promise<AuthSession> {
    const validation = validateSignIn(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new AuthError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    try {
      const session = await this.provider.signIn(dto);
      return {
        ...session,
        user: this.sanitizeUser(session.user),
      };
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      if (err instanceof MockProviderError) {
        throw new AuthError(err.message, err.code, err.status);
      }
      const message = err instanceof Error ? err.message : "Invalid credentials.";
      throw new AuthError(message, "INVALID_CREDENTIALS", 401);
    }
  }

  /**
   * Verifies an active session token and returns the current user identity.
   */
  public async verifySession(token: string): Promise<AuthUser | null> {
    if (!token || typeof token !== "string") return null;
    const user = await this.provider.verifySession(token);
    return user ? this.sanitizeUser(user) : null;
  }

  /**
   * Ends an active session.
   */
  public async signOut(token: string): Promise<void> {
    if (token) {
      await this.provider.signOut(token);
    }
  }

  /**
   * Initiates password reset flow.
   */
  public async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const validation = validateForgotPassword(dto);
    if (!validation.isValid) {
      const firstErrorMessage = Object.values(validation.errors)[0]?.[0] || "Validation failed.";
      throw new AuthError(
        firstErrorMessage,
        "VALIDATION_ERROR",
        400,
        validation.errors
      );
    }

    try {
      return await this.provider.forgotPassword(dto);
    } catch (err: unknown) {
      if (err instanceof AuthError) throw err;
      const message = err instanceof Error ? err.message : "Failed to process forgot password request.";
      throw new AuthError(message, "INTERNAL_SERVER_ERROR", 500);
    }
  }

  /**
   * Ensures that no sensitive authentication credentials (passwords, salts, hashes)
   * can ever be returned to callers or clients.
   */
  public sanitizeUser<T extends Partial<AuthUser>>(user: T): AuthUser {
    return {
      id: String(user.id || ""),
      name: String(user.name || ""),
      email: String(user.email || ""),
      phone: String(user.phone || ""),
      createdAt: String(user.createdAt || new Date().toISOString()),
      businessId: user.businessId ? String(user.businessId) : null,
      role: (user.role as AuthUser["role"]) ?? null,
    };
  }

  /**
   * Formats errors into the standardized API error shape.
   */
  public formatError(err: unknown): { status: number; body: ApiErrorResponse } {
    if (err instanceof AuthError) {
      return {
        status: err.status,
        body: {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          },
        },
      };
    }

    if (err instanceof Error) {
      return {
        status: 500,
        body: {
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: err.message || "An unexpected error occurred.",
          },
        },
      };
    }

    return {
      status: 500,
      body: {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
      },
    };
  }
}

// Global singleton instance for application runtime
const globalForAuth = globalThis as unknown as { authService?: AuthService };

export const authService = globalForAuth.authService || new AuthService();

if (process.env.NODE_ENV !== "production") {
  globalForAuth.authService = authService;
}
