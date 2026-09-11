# KaamSetu — Level 1: Authentication Architecture & Specifications

This document details the architectural design, implementation details, API specifications, and operational workflows for **Level 1 (Complete Authentication)** of KaamSetu.

---

## 1. Purpose of Authentication

KaamSetu is the digital operating system for India's local service businesses, starting with AC service and repair operations. Because service operations involve business-critical and customer-sensitive data (jobs, technicians, quotations, invoices, and customer contact information), secure identity verification is the root foundation of the system.

In Level 1, we establish a clean identity and session layer that strictly separates:
- **User Identity** (`AuthUser`): Authentication credentials and personal identity.
- **Application Context**: Separation between the human user account and future multi-tenant business entities (`USER != BUSINESS`).
- **Authorization Context**: Designed to support future multi-role access (`OWNER`, `MANAGER`, `TECHNICIAN`, `CUSTOMER`) without re-architecting the session lifecycle.

---

## 2. Authentication Flows

### A. Signup Flow (`/register` & `POST /api/v1/auth/signup`)

1. User opens `/register` and fills in:
   - **Name**: Required (minimum 2 characters).
   - **Email**: Valid email format (RFC standard).
   - **Phone**: Indian mobile format (10 digits starting with 6–9).
   - **Password**: Minimum 8 characters.
   - **Confirm Password**: Must strictly match password.
2. Frontend runs real-time and pre-submit client validation.
3. Form dispatches `POST /api/v1/auth/signup` to backend.
4. Backend `AuthService` runs authoritative validation using `validateSignUp()`.
5. Active provider (`MockAuthProvider` or future `CognitoAuthProvider`) creates the identity record. Duplicate emails are rejected with `409 USER_ALREADY_EXISTS`.
6. Password is never stored in plaintext (even in mock mode, it uses salted SHA-256).
7. Backend signs the user in, generates a session token, and attaches a secure, HTTP-only `kaamsetu_session` cookie (`Max-Age=86400`, `Path=/`, `SameSite=Lax`, `Secure` in production).
8. Client receives sanitized `AuthUser` data and redirects to `/dashboard`.

### B. Signin Flow (`/login` & `POST /api/v1/auth/signin`)

1. User opens `/login` and provides `email` and `password`.
2. Client submits `POST /api/v1/auth/signin`.
3. Backend validates input payload and invokes `authService.signIn()`.
4. Provider verifies password hash against stored salt. If invalid or user does not exist, a unified `401 INVALID_CREDENTIALS` error is returned to prevent account enumeration attacks.
5. On success, an active session is generated with a 24-hour expiration.
6. HTTP-only cookie `kaamsetu_session` is set on the response.
7. User is redirected to `/dashboard` (or the URL specified in the `?redirect=` query parameter).

### C. Logout Flow (`POST /api/v1/auth/logout`)

1. User clicks "Sign Out" from the dashboard, navigation, or `/dev/auth`.
2. Client sends `POST /api/v1/auth/logout` with credentials included.
3. Backend extracts session token from the cookie or `Authorization: Bearer <token>` header and terminates the session in the provider.
4. Response instructs browser to clear the cookie by setting `Max-Age=0`.
5. Frontend state is cleared (`user = null`) and the user is redirected to `/login`.

### D. Current User Flow (`GET /api/v1/auth/me`)

1. Client initializes or refreshes auth context via `authClient.getMe()`.
2. Backend middleware guard (`authenticateRequest`) validates the session token.
3. Returns sanitized user profile:
   ```json
   {
     "success": true,
     "data": {
       "id": "usr_78f1491cf15243d9",
       "name": "Rishi Kumar",
       "email": "rishi@example.com",
       "phone": "9876543210"
     }
   }
   ```
4. Sensitive fields (`password`, `passwordHash`, `salt`) are omitted.

### E. Forgot Password Flow (`/forgot-password` & `POST /api/v1/auth/forgot-password`)

1. User submits email address via `/forgot-password`.
2. Backend validates email syntax and dispatches instruction via provider.
3. In mock mode, a development notice is returned.
4. In production, recovery will be managed securely by AWS Cognito without exposing whether an account exists.

---

## 3. Protected Route Behavior

- **Edge / Application Level**: Handled by Next.js 16 `proxy.ts` (the successor to deprecated `middleware.ts`).
  - Intercepts requests to `/dashboard/:path*`.
  - Unauthenticated requests lacking `kaamsetu_session` cookie are redirected to `/login?redirect=<path>`.
  - Authenticated requests visiting `/login` or `/register` are forwarded directly to `/dashboard`.
- **Backend API Guard**: Defined in `backend/src/modules/auth/auth.middleware.ts`.
  - Any protected route handler invokes `await authenticateRequest(req)`.
  - Inspects both HTTP cookies (`kaamsetu_session`) and HTTP Bearer tokens (`Authorization: Bearer <token>`).
  - Rejects unauthenticated or expired calls with `401 UNAUTHORIZED`.

---

## 4. Architecture & Provider Abstraction

The authentication system is cleanly decoupled into 3 layers:

```
                  ┌─────────────────────────────────────┐
                  │          Next.js App Router         │
                  │   /register, /login, /dashboard     │
                  └──────────────────┬──────────────────┘
                                     │ (HTTP / JSON)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │         HTTP Controller Layer       │
                  │        app/api/v1/auth/*            │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │             AuthService             │
                  │   backend/src/modules/auth/service  │
                  └──────────────────┬──────────────────┘
                                     │
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
       ┌──────────────────────┐              ┌──────────────────────┐
       │   MockAuthProvider   │              │ CognitoAuthProvider  │
       │ (Active Development) │              │ (Pending AWS Handoff)│
       └──────────────────────┘              └──────────────────────┘
```

### `IAuthProvider` Interface
Every provider implements the contract:
- `signUp(dto: SignUpDto): Promise<AuthUser>`
- `signIn(dto: SignInDto): Promise<AuthSession>`
- `verifySession(token: string): Promise<AuthUser | null>`
- `signOut(token: string): Promise<void>`
- `forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }>`

Switching between providers is controlled via environment variable `AUTH_PROVIDER=mock` vs `AUTH_PROVIDER=cognito`.

---

## 5. API Contracts

### Standard Success Format
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable explanation",
    "details": {
      "fieldName": ["Validation error message"]
    }
  }
}
```

### Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/signup` | Register account and establish session | No |
| `POST` | `/api/v1/auth/signin` | Authenticate user credentials and set cookie | No |
| `POST` | `/api/v1/auth/logout` | Terminate session and clear cookie | Optional/Yes |
| `GET` | `/api/v1/auth/me` | Retrieve authenticated profile | Yes |
| `POST` | `/api/v1/auth/forgot-password` | Initiate password recovery | No |
| `GET` | `/api/v1/test/protected` | Test endpoint to verify backend guard | Yes |

---

## 6. Security Considerations

1. **No Plaintext Passwords**: Even in `MockAuthProvider`, passwords are never stored in plaintext. They are salted and hashed using Node's standard `node:crypto` SHA-256.
2. **Never Return or Log Passwords**: The `AuthService.sanitizeUser()` method ensures that password strings, hashes, and salts are completely stripped from any object before returning to controllers or the frontend.
3. **HTTP-Only Cookies**: Session tokens are transmitted and saved via `HttpOnly`, `SameSite=Lax` cookies to mitigate XSS exposure. Bearer tokens in headers are also supported for programmatic API callers.
4. **Backend-Authoritative Security**: Client-side UI state (`useAuth()`) is purely for user experience. Route access and backend data modification are authoritatively enforced on the server via `proxy.ts` and `authenticateRequest()`.
5. **Multi-Tenant / Future-Proof Design**: User identity context stores `userId`, `businessId` (nullable in Level 1), and `role` (nullable in Level 1), preparing for Level 2 business establishment and tenant isolation.

---

## 7. Manish AWS Handoff

The production authentication engine will use AWS Cognito. AWS infrastructure is managed by Manish.

The provider boundary is located at:
[backend/src/modules/auth/cognito-auth.provider.ts](file:///home/xkrishna/startup-kaamsetu/backend/src/modules/auth/cognito-auth.provider.ts)

It contains the required boundary handoff comment:
```typescript
// ============================================================
// AWS HANDOFF — MANISH
// START FROM HERE
// ============================================================
//
// Production authentication integration required here.
//
// Target:
// AWS Cognito
//
// Current implementation:
// Development/mock authentication provider.
//
// Requirements:
// - Cognito user authentication
// - token/session handling
// - identity verification
// - environment configuration
//
// Do not change the public API contract without coordinating
// with the backend owner.
//
// ============================================================
```

### Steps for Manish to Activate Production Cognito:
1. Provision AWS Cognito User Pool with email sign-in alias.
2. Configure AWS SDK in `CognitoAuthProvider` using AWS Client credentials or IAM roles.
3. Implement `signUp`, `signIn` (AdminInitiateAuth / InitiateAuth), `verifySession` (JWT signature verification using Cognito JWKS), and `forgotPassword`.
4. Set environment variable `AUTH_PROVIDER=cognito`.

---

## 8. Automated Testing

Automated test suite is implemented in [tests/auth.test.ts](file:///home/xkrishna/startup-kaamsetu/tests/auth.test.ts) using Node's native test runner (`node:test`) and jiti runtime loader.

To execute tests:
```bash
npm test
```

### Covered Test Cases:
1. `Signup succeeds with valid data`: Verifies 201 status, user ID creation, session token, and cookie assignment.
2. `Signup rejects missing name`: Validates 400 status and field error.
3. `Signup rejects invalid email`: Validates 400 status and email format error.
4. `Signup rejects password mismatch`: Validates 400 status when confirmPassword differs.
5. `Signup rejects duplicate email`: Validates 409 status and duplicate account rejection.
6. `Signin succeeds with valid credentials`: Validates 200 status, token, and session cookie.
7. `Signin rejects invalid credentials`: Validates 401 status and unified error message.
8. `/me returns authenticated user`: Validates safe user details retrieved via session cookie.
9. `Protected endpoint rejects unauthenticated request`: Validates 401 UNAUTHORIZED.
10. `Protected endpoint accepts authenticated request`: Validates 200 status via Bearer token.
11. `Logout clears authentication`: Validates 200 status and session cookie deletion (`Max-Age=0`).
12. `Protected endpoint rejects request after logout`: Validates that revoked session cannot access protected routes.
13. `Forgot-password validates input`: Validates syntax checking and mock recovery response.
14. `Password information is never returned in API responses`: Deep checks JSON stringified payloads of signup, signin, `/me`, and protected endpoints to guarantee zero password/hash/salt leakage.

---

## 9. What is Intentionally Postponed to Level 2

As specified in project requirements, Level 1 exclusively delivers the authentication engine. The following features belong to subsequent development stages:
- Business registration and onboarding (`USER != BUSINESS`)
- Team member roles and permissions (`OWNER`, `MANAGER`, `TECHNICIAN`)
- Customers and customer profiles
- AC Service / Repair job lifecycles
- Quotations, Invoicing, and Payment gateways
- WhatsApp / SMS notifications
- Analytics and AI assistance
