import crypto from "node:crypto";
import { IAuthProvider } from "./auth.provider";
import {
  AuthUser,
  AuthSession,
  SignUpDto,
  SignInDto,
  ForgotPasswordDto,
} from "./auth.types";
import { normalizePhone } from "./auth.validation";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface StoredSession {
  token: string;
  userId: string;
  expiresAt: Date;
}

export class MockProviderError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "MockProviderError";
    this.code = code;
    this.status = status;
  }
}

/**
 * MockAuthProvider
 * 
 * In-memory authentication provider for development and automated testing.
 * Implements secure hashing (salted SHA-256) even in development so passwords
 * are never stored in plaintext.
 * 
 * NOTE: This provider is for development/testing only and stores data in memory.
 * Production deployments must use AWS Cognito via CognitoAuthProvider.
 */
export class MockAuthProvider implements IAuthProvider {
  public readonly providerName = "mock";

  // In-memory store: email -> StoredUser
  private usersByEmail = new Map<string, StoredUser>();
  // In-memory store: id -> StoredUser
  private usersById = new Map<string, StoredUser>();
  // In-memory store: token -> StoredSession
  private sessionsByToken = new Map<string, StoredSession>();

  private hashPassword(password: string, salt: string): string {
    return crypto.createHash("sha256").update(password + ":" + salt).digest("hex");
  }

  public async signUp(dto: SignUpDto): Promise<AuthUser> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new MockProviderError(
        "An account with this email address already exists.",
        "USER_ALREADY_EXISTS",
        409
      );
    }

    const userId = "usr_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = this.hashPassword(dto.password, salt);
    const createdAt = new Date().toISOString();

    const storedUser: StoredUser = {
      id: userId,
      name: dto.name.trim(),
      email: normalizedEmail,
      phone: normalizePhone(dto.phone),
      passwordHash,
      salt,
      createdAt,
    };

    this.usersByEmail.set(normalizedEmail, storedUser);
    this.usersById.set(userId, storedUser);

    return {
      id: storedUser.id,
      name: storedUser.name,
      email: storedUser.email,
      phone: storedUser.phone,
      createdAt: storedUser.createdAt,
    };
  }

  public async signIn(dto: SignInDto): Promise<AuthSession> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const storedUser = this.usersByEmail.get(normalizedEmail);

    if (!storedUser) {
      throw new MockProviderError(
        "Invalid email or password.",
        "INVALID_CREDENTIALS",
        401
      );
    }

    const computedHash = this.hashPassword(dto.password, storedUser.salt);
    if (computedHash !== storedUser.passwordHash) {
      throw new MockProviderError(
        "Invalid email or password.",
        "INVALID_CREDENTIALS",
        401
      );
    }

    // Create session (valid for 24 hours)
    const token = "kaamsetu_sess_" + crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    this.sessionsByToken.set(token, {
      token,
      userId: storedUser.id,
      expiresAt,
    });

    return {
      token,
      user: {
        id: storedUser.id,
        name: storedUser.name,
        email: storedUser.email,
        phone: storedUser.phone,
        createdAt: storedUser.createdAt,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async verifySession(token: string): Promise<AuthUser | null> {
    if (!token) return null;

    const session = this.sessionsByToken.get(token);
    if (!session) return null;

    // Check expiry
    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessionsByToken.delete(token);
      return null;
    }

    const user = this.usersById.get(session.userId);
    if (!user) {
      this.sessionsByToken.delete(token);
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    };
  }

  public async signOut(token: string): Promise<void> {
    if (token) {
      this.sessionsByToken.delete(token);
    }
  }

  public async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = this.usersByEmail.get(normalizedEmail);

    return {
      message: user
        ? `Password reset instructions sent to ${normalizedEmail} (Mock flow).`
        : `If an account with that email exists, reset instructions have been dispatched.`,
    };
  }

  /**
   * Test helper to reset internal in-memory state.
   */
  public __resetForTesting(): void {
    this.usersByEmail.clear();
    this.usersById.clear();
    this.sessionsByToken.clear();
  }
}
