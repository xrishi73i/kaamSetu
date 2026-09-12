// ============================================================
// AWS Cognito Authentication Provider — KaamSetu
// ============================================================
//
// Production authentication provider integrating with AWS Cognito.
//
// Required environment variables:
//   AWS_REGION           — e.g. "ap-south-1"
//   COGNITO_USER_POOL_ID — e.g. "ap-south-1_xxxxxxxxx"
//   COGNITO_CLIENT_ID    — App Client ID (no secret)
//
// Do not change the public API contract (IAuthProvider) without
// coordinating with the backend owner.
//
// ============================================================

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  GlobalSignOutCommand,
  ForgotPasswordCommand,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";

import { IAuthProvider } from "./auth.provider";
import { AuthError } from "./auth.service";
import {
  AuthUser,
  AuthSession,
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
} from "./auth.types";
import { normalizePhone } from "./auth.validation";

/**
 * Extracts a named attribute from a Cognito user attributes array.
 */
function getAttribute(
  attrs: AttributeType[] | undefined,
  name: string
): string {
  return attrs?.find((a) => a.Name === name)?.Value ?? "";
}

/**
 * Formats a phone number into E.164 format for Cognito.
 * Cognito requires phone_number in +<country><number> format.
 */
function toE164Phone(phone: string): string {
  const digits = normalizePhone(phone);
  // Indian phone numbers: prefix with +91
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  // If already has country code
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  // Fallback: return as-is with + prefix
  return `+${digits}`;
}

/**
 * CognitoAuthProvider
 *
 * Production authentication provider integrating with AWS Cognito User Pool.
 * Implements the IAuthProvider interface for seamless swap with MockAuthProvider.
 *
 * Architecture:
 * - Uses USER_PASSWORD_AUTH flow (server-side, no SRP)
 * - Tokens: Cognito AccessToken used as session token
 * - User attributes stored in Cognito: email, name, phone_number
 * - No client secret (public app client)
 */
export class CognitoAuthProvider implements IAuthProvider {
  public readonly providerName = "cognito";

  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!region || !userPoolId || !clientId) {
      throw new Error(
        "CognitoAuthProvider requires AWS_REGION, COGNITO_USER_POOL_ID, and COGNITO_CLIENT_ID environment variables."
      );
    }

    this.userPoolId = userPoolId;
    this.clientId = clientId;

    this.client = new CognitoIdentityProviderClient({ region });
  }

  /**
   * Registers a new user in the Cognito User Pool.
   *
   * Cognito will send a verification email with a confirmation code.
   * The user must verify their email before they can sign in.
   *
   * Maps KaamSetu fields to Cognito user attributes:
   *   name  → "name"
   *   email → "email" (also used as username)
   *   phone → "phone_number" (E.164 format)
   */
  public async signUp(dto: SignUpDto): Promise<AuthUser> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      const result = await this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: normalizedEmail,
          Password: dto.password,
          UserAttributes: [
            { Name: "email", Value: normalizedEmail },
            { Name: "name", Value: dto.name.trim() },
            { Name: "phone_number", Value: toE164Phone(dto.phone) },
          ],
        })
      );

      return {
        id: result.UserSub ?? "",
        name: dto.name.trim(),
        email: normalizedEmail,
        phone: normalizePhone(dto.phone),
        createdAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      this.throwMappedError(err, "signUp");
    }
  }

  /**
   * Authenticates a user using USER_PASSWORD_AUTH flow.
   *
   * Returns the Cognito AccessToken as the session token.
   * The AccessToken is used for all subsequent authenticated requests.
   */
  public async signIn(dto: SignInDto): Promise<AuthSession> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      const result = await this.client.send(
        new InitiateAuthCommand({
          ClientId: this.clientId,
          AuthFlow: "USER_PASSWORD_AUTH",
          AuthParameters: {
            USERNAME: normalizedEmail,
            PASSWORD: dto.password,
          },
        })
      );

      const authResult = result.AuthenticationResult;
      if (!authResult?.AccessToken) {
        throw new Error("Authentication succeeded but no access token returned.");
      }

      // Fetch user attributes using the access token
      const user = await this.getUserFromAccessToken(authResult.AccessToken);

      // Calculate expiry from ExpiresIn (seconds) — defaults to 1 hour
      const expiresInMs = (authResult.ExpiresIn ?? 3600) * 1000;
      const expiresAt = new Date(Date.now() + expiresInMs);

      return {
        token: authResult.AccessToken,
        user,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err: unknown) {
      this.throwMappedError(err, "signIn");
    }
  }

  /**
   * Verifies an active session by calling Cognito GetUser with the AccessToken.
   *
   * Returns the user if the token is valid, or null if expired/revoked.
   */
  public async verifySession(token: string): Promise<AuthUser | null> {
    if (!token) return null;

    try {
      return await this.getUserFromAccessToken(token);
    } catch {
      // Token is invalid, expired, or revoked
      return null;
    }
  }

  /**
   * Signs out the user globally — revokes all tokens for the user.
   *
   * Uses GlobalSignOut to invalidate all sessions, not just the current one.
   * This is the most secure approach for production.
   */
  public async signOut(token: string): Promise<void> {
    if (!token) return;

    try {
      await this.client.send(
        new GlobalSignOutCommand({
          AccessToken: token,
        })
      );
    } catch {
      // If token is already expired/invalid, sign-out is effectively done
    }
  }

  /**
   * Initiates the Cognito forgot-password flow.
   *
   * Cognito sends a verification code to the user's verified email.
   * The user must call ConfirmForgotPassword with the code + new password
   * to complete the reset (this will be a future endpoint if needed).
   */
  public async forgotPassword(
    dto: ForgotPasswordDto
  ): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: normalizedEmail,
        })
      );

      return {
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      };
    } catch (err: unknown) {
      // For security, don't reveal whether the user exists
      const errorName = (err as { name?: string })?.name;

      if (errorName === "UserNotFoundException") {
        return {
          message:
            "If an account with that email exists, password reset instructions have been sent.",
        };
      }

      // For other Cognito errors, still return generic message
      // but log for debugging
      console.error("[CognitoAuthProvider] forgotPassword error:", err);
      return {
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      };
    }
  }

  // ===========================================================
  // Private helpers
  // ===========================================================

  /**
   * Fetches user profile from Cognito using an AccessToken.
   */
  private async getUserFromAccessToken(
    accessToken: string
  ): Promise<AuthUser> {
    const result = await this.client.send(
      new GetUserCommand({
        AccessToken: accessToken,
      })
    );

    const attrs = result.UserAttributes;
    const sub = getAttribute(attrs, "sub");
    const email = getAttribute(attrs, "email");
    const name = getAttribute(attrs, "name");
    const phoneNumber = getAttribute(attrs, "phone_number");

    // Strip E.164 prefix for internal representation
    const phone = phoneNumber.replace(/^\+91/, "");

    return {
      id: sub,
      name,
      email,
      phone,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Maps Cognito SDK errors to the error codes expected by AuthService.
   *
   * AuthService already handles:
   *   - USER_ALREADY_EXISTS (signUp)
   *   - INVALID_CREDENTIALS (signIn)
   *   - INTERNAL_SERVER_ERROR (fallback)
   *
   * We throw Error with descriptive messages and let AuthService
   * map them to the correct HTTP status codes.
   */
  private throwMappedError(err: unknown, context: string): never {
    const errorName = (err as { name?: string })?.name;
    const errorMessage =
      (err as { message?: string })?.message ?? "An unexpected error occurred.";

    console.error(`[CognitoAuthProvider] ${context} error:`, errorName, errorMessage);

    switch (errorName) {
      // Sign-up errors
      case "UsernameExistsException":
        throw new AuthError(
          "An account with this email address already exists.",
          "USER_ALREADY_EXISTS",
          409
        );

      // Sign-in errors
      case "NotAuthorizedException":
        throw new AuthError(
          "Invalid email or password.",
          "INVALID_CREDENTIALS",
          401
        );

      case "UserNotConfirmedException":
        throw new AuthError(
          "Account not verified. Please check your email for a verification code.",
          "USER_NOT_CONFIRMED",
          403
        );

      case "UserNotFoundException":
        throw new AuthError(
          "Invalid email or password.",
          "INVALID_CREDENTIALS",
          401
        );

      // Password policy
      case "InvalidPasswordException":
        throw new AuthError(
          "Password does not meet requirements: minimum 8 characters, with uppercase, lowercase, numbers, and symbols.",
          "VALIDATION_ERROR",
          400
        );

      // Rate limiting
      case "TooManyRequestsException":
      case "LimitExceededException":
        throw new AuthError(
          "Too many requests. Please try again later.",
          "RATE_LIMITED",
          429
        );

      // Catch-all
      default:
        throw new AuthError(
          errorMessage,
          "INTERNAL_SERVER_ERROR",
          500
        );
    }
  }
}
