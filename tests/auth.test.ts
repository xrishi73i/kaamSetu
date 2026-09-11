import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { authService } from "../backend/src/modules/auth/auth.service.ts";
import { MockAuthProvider } from "../backend/src/modules/auth/mock-auth.provider.ts";
import { POST as signupRoute } from "../app/api/v1/auth/signup/route.ts";
import { POST as signinRoute } from "../app/api/v1/auth/signin/route.ts";
import { POST as logoutRoute } from "../app/api/v1/auth/logout/route.ts";
import { GET as meRoute } from "../app/api/v1/auth/me/route.ts";
import { POST as forgotPasswordRoute } from "../app/api/v1/auth/forgot-password/route.ts";
import { GET as protectedRoute } from "../app/api/v1/test/protected/route.ts";

describe("KaamSetu Level 1 - Authentication Module Tests", () => {
  const provider = authService.getProvider() as MockAuthProvider;

  beforeEach(() => {
    // Reset in-memory database between tests
    provider.__resetForTesting();
  });

  // 1. Signup succeeds with valid data
  it("1. Signup succeeds with valid data", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rishi Kumar",
        email: "rishi@example.com",
        phone: "9876543210",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });

    const res = await signupRoute(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.user.id.startsWith("usr_"));
    assert.equal(json.data.user.name, "Rishi Kumar");
    assert.equal(json.data.user.email, "rishi@example.com");
    assert.equal(json.data.user.phone, "9876543210");
    assert.ok(json.data.token.startsWith("kaamsetu_sess_"));

    // Verify cookie set
    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie?.includes("kaamsetu_session="));
    assert.ok(setCookie?.includes("HttpOnly"));
  });

  // 2. Signup rejects missing name
  it("2. Signup rejects missing name", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "rishi@example.com",
        phone: "9876543210",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });

    const res = await signupRoute(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "VALIDATION_ERROR");
    assert.ok(json.error.message.includes("Name is required"));
  });

  // 3. Signup rejects invalid email
  it("3. Signup rejects invalid email", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rishi Kumar",
        email: "not-an-email",
        phone: "9876543210",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });

    const res = await signupRoute(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "VALIDATION_ERROR");
    assert.ok(json.error.message.includes("valid email"));
  });

  // 4. Signup rejects password mismatch
  it("4. Signup rejects password mismatch", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rishi Kumar",
        email: "rishi@example.com",
        phone: "9876543210",
        password: "Password123!",
        confirmPassword: "DifferentPassword456!",
      }),
    });

    const res = await signupRoute(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "VALIDATION_ERROR");
    assert.ok(json.error.message.includes("Passwords do not match"));
  });

  // 5. Signup rejects duplicate email
  it("5. Signup rejects duplicate email", async () => {
    const signupData = {
      name: "Rishi Kumar",
      email: "duplicate@example.com",
      phone: "9876543210",
      password: "Password123!",
      confirmPassword: "Password123!",
    };

    // First signup
    const req1 = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });
    const res1 = await signupRoute(req1);
    assert.equal(res1.status, 201);

    // Second signup with same email
    const req2 = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });
    const res2 = await signupRoute(req2);
    assert.equal(res2.status, 409);

    const json2 = await res2.json();
    assert.equal(json2.success, false);
    assert.equal(json2.error.code, "USER_ALREADY_EXISTS");
  });

  // 6. Signin succeeds with valid credentials
  it("6. Signin succeeds with valid credentials", async () => {
    // Register user
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const req = new Request("http://localhost:3000/api/v1/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "rishi@example.com",
        password: "Password123!",
      }),
    });

    const res = await signinRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user.email, "rishi@example.com");
    assert.ok(json.data.token.startsWith("kaamsetu_sess_"));

    const setCookie = res.headers.get("set-cookie");
    assert.ok(setCookie?.includes("kaamsetu_session="));
  });

  // 7. Signin rejects invalid credentials
  it("7. Signin rejects invalid credentials", async () => {
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const req = new Request("http://localhost:3000/api/v1/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "rishi@example.com",
        password: "WrongPassword!",
      }),
    });

    const res = await signinRoute(req);
    assert.equal(res.status, 401);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "INVALID_CREDENTIALS");
  });

  // 8. /me returns authenticated user
  it("8. /me returns authenticated user", async () => {
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: "rishi@example.com",
      password: "Password123!",
    });

    // Request with cookie
    const req = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${session.token}`,
      },
    });

    const res = await meRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.email, "rishi@example.com");
    assert.equal(json.data.name, "Rishi Kumar");
    assert.equal(json.data.phone, "9876543210");
  });

  // 9. Protected endpoint rejects unauthenticated request
  it("9. Protected endpoint rejects unauthenticated request", async () => {
    const req = new Request("http://localhost:3000/api/v1/test/protected", {
      method: "GET",
    });

    const res = await protectedRoute(req);
    assert.equal(res.status, 401);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "UNAUTHORIZED");
  });

  // 10. Protected endpoint accepts authenticated request
  it("10. Protected endpoint accepts authenticated request", async () => {
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: "rishi@example.com",
      password: "Password123!",
    });

    // Request using Bearer token header
    const req = new Request("http://localhost:3000/api/v1/test/protected", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    const res = await protectedRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.authenticatedUser.email, "rishi@example.com");
  });

  // 11. Logout clears authentication
  it("11. Logout clears authentication", async () => {
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: "rishi@example.com",
      password: "Password123!",
    });

    const logoutReq = new Request("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${session.token}`,
      },
    });

    const logoutRes = await logoutRoute(logoutReq);
    assert.equal(logoutRes.status, 200);

    const logoutJson = await logoutRes.json();
    assert.equal(logoutJson.success, true);

    const setCookie = logoutRes.headers.get("set-cookie");
    assert.ok(setCookie?.includes("Max-Age=0"));
  });

  // 12. Protected endpoint rejects request after logout
  it("12. Protected endpoint rejects request after logout", async () => {
    await authService.signUp({
      name: "Rishi Kumar",
      email: "rishi@example.com",
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: "rishi@example.com",
      password: "Password123!",
    });

    // Call logout
    await logoutRoute(
      new Request("http://localhost:3000/api/v1/auth/logout", {
        method: "POST",
        headers: { Cookie: `kaamsetu_session=${session.token}` },
      })
    );

    // Call protected endpoint using revoked token
    const testReq = new Request("http://localhost:3000/api/v1/test/protected", {
      method: "GET",
      headers: { Cookie: `kaamsetu_session=${session.token}` },
    });

    const testRes = await protectedRoute(testReq);
    assert.equal(testRes.status, 401);

    const testJson = await testRes.json();
    assert.equal(testJson.success, false);
    assert.equal(testJson.error.code, "UNAUTHORIZED");
  });

  // 13. Forgot-password validates input
  it("13. Forgot-password validates input", async () => {
    // Missing/invalid email
    const invalidReq = new Request("http://localhost:3000/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }),
    });
    const invalidRes = await forgotPasswordRoute(invalidReq);
    assert.equal(invalidRes.status, 400);
    const invalidJson = await invalidRes.json();
    assert.equal(invalidJson.error.code, "VALIDATION_ERROR");

    // Valid email
    const validReq = new Request("http://localhost:3000/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rishi@example.com" }),
    });
    const validRes = await forgotPasswordRoute(validReq);
    assert.equal(validRes.status, 200);
    const validJson = await validRes.json();
    assert.equal(validJson.success, true);
    assert.ok(validJson.data.message.includes("instructions"));
  });

  // 14. Password information is never returned in API responses
  it("14. Password information is never returned in API responses", async () => {
    // 14a. Signup response
    const signupReq = new Request("http://localhost:3000/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rishi Kumar",
        email: "security@example.com",
        phone: "9876543210",
        password: "Password123!",
        confirmPassword: "Password123!",
      }),
    });
    const signupRes = await signupRoute(signupReq);
    const signupJson = await signupRes.json();
    const signupText = JSON.stringify(signupJson);

    assert.equal(signupText.includes("Password123!"), false);
    assert.equal(signupText.includes("passwordHash"), false);
    assert.equal(signupText.includes("salt"), false);

    // 14b. Signin response
    const signinReq = new Request("http://localhost:3000/api/v1/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "security@example.com",
        password: "Password123!",
      }),
    });
    const signinRes = await signinRoute(signinReq);
    const signinJson = await signinRes.json();
    const signinText = JSON.stringify(signinJson);

    assert.equal(signinText.includes("Password123!"), false);
    assert.equal(signinText.includes("passwordHash"), false);
    assert.equal(signinText.includes("salt"), false);

    // 14c. /me response
    const meReq = new Request("http://localhost:3000/api/v1/auth/me", {
      method: "GET",
      headers: { Cookie: `kaamsetu_session=${signinJson.data.token}` },
    });
    const meRes = await meRoute(meReq);
    const meJson = await meRes.json();
    const meText = JSON.stringify(meJson);

    assert.equal(meText.includes("Password123!"), false);
    assert.equal(meText.includes("passwordHash"), false);
    assert.equal(meText.includes("salt"), false);
  });
});
