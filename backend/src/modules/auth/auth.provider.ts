import {
  AuthUser,
  AuthSession,
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
} from "./auth.types";

/**
 * Authentication Provider Interface
 * 
 * Defines the contract that all authentication providers (e.g., Mock, AWS Cognito)
 * must implement. This ensures the business logic and controllers remain agnostic
 * of the underlying identity provider.
 */
export interface IAuthProvider {
  readonly providerName: string;

  /**
   * Registers a new user account with the provider.
   */
  signUp(dto: SignUpDto): Promise<AuthUser>;

  /**
   * Authenticates user credentials and establishes a session.
   */
  signIn(dto: SignInDto): Promise<AuthSession>;

  /**
   * Verifies an active session token and returns the authenticated user, or null if invalid.
   */
  verifySession(token: string): Promise<AuthUser | null>;

  /**
   * Terminates the active session associated with the token.
   */
  signOut(token: string): Promise<void>;

  /**
   * Initiates password recovery/reset flow.
   */
  forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }>;
}
