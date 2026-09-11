import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { authService } from "../backend/src/modules/auth/auth.service.ts";
import { MockAuthProvider } from "../backend/src/modules/auth/mock-auth.provider.ts";
import { businessRepository } from "../backend/src/modules/business/business.repository.ts";
import { memberRepository } from "../backend/src/modules/members/member.repository.ts";

import {
  POST as createBusinessRoute,
  GET as getBusinessRoute,
  PATCH as updateBusinessRoute,
} from "../app/api/v1/business/route.ts";
import {
  GET as listMembersRoute,
  POST as inviteMemberRoute,
} from "../app/api/v1/business/members/route.ts";
import { PATCH as updateMemberRoute } from "../app/api/v1/business/members/[id]/route.ts";

describe("KaamSetu Level 2 - Business & Members Module Tests", () => {
  const authProvider = authService.getProvider() as MockAuthProvider;

  beforeEach(() => {
    authProvider.__resetForTesting();
    businessRepository.__resetForTesting();
    memberRepository.__resetForTesting();
  });

  // Helper to register and sign in a user, returning the session token and user
  async function createTestSession(
    name: string,
    email: string,
    phone = "9876543210"
  ) {
    const user = await authService.signUp({
      name,
      email,
      phone,
      password: "Password123!",
    });

    const session = await authService.signIn({
      email,
      password: "Password123!",
    });

    return { user, token: session.token };
  }

  // 1. Create business succeeds for authenticated user, assigns OWNER role
  it("1. Create business succeeds for authenticated user, assigns OWNER role", async () => {
    const { token, user } = await createTestSession("Rishi Kumar", "rishi@example.com");

    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${token}`,
      },
      body: JSON.stringify({
        name: "Rishi Cooling Services",
        phone: "9876543210",
        address: "Plot 42, Okhla Phase III, New Delhi",
      }),
    });

    const res = await createBusinessRoute(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.business.id.startsWith("biz_"));
    assert.equal(json.data.business.name, "Rishi Cooling Services");
    assert.equal(json.data.business.phone, "9876543210");
    assert.equal(json.data.business.address, "Plot 42, Okhla Phase III, New Delhi");

    // Verify creator is assigned OWNER
    assert.equal(json.data.member.role, "OWNER");
    assert.equal(json.data.member.status, "ACTIVE");
    assert.equal(json.data.member.userId, user.id);
    assert.equal(json.data.member.businessId, json.data.business.id);
  });

  // 2. Create business rejects unauthenticated request (401)
  it("2. Create business rejects unauthenticated request (401)", async () => {
    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Rishi Cooling Services",
        phone: "9876543210",
        address: "New Delhi",
      }),
    });

    const res = await createBusinessRoute(req);
    assert.equal(res.status, 401);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "UNAUTHORIZED");
  });

  // 3. Create business rejects invalid name or phone (400)
  it("3. Create business rejects invalid name or phone (400)", async () => {
    const { token } = await createTestSession("Rishi Kumar", "rishi@example.com");

    // Missing name
    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${token}`,
      },
      body: JSON.stringify({
        name: "",
        phone: "123", // invalid phone
        address: "Delhi",
      }),
    });

    const res = await createBusinessRoute(req);
    assert.equal(res.status, 400);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "VALIDATION_ERROR");
  });

  // 4. Create business rejects if user already owns a business (409)
  it("4. Create business rejects if user already owns a business (409)", async () => {
    const { token } = await createTestSession("Rishi Kumar", "rishi@example.com");

    const payload = JSON.stringify({
      name: "Rishi Cooling Services",
      phone: "9876543210",
      address: "Delhi",
    });

    // First creation
    const req1 = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: payload,
    });
    const res1 = await createBusinessRoute(req1);
    assert.equal(res1.status, 201);

    // Second creation by same user
    const req2 = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: payload,
    });
    const res2 = await createBusinessRoute(req2);
    assert.equal(res2.status, 409);

    const json2 = await res2.json();
    assert.equal(json2.success, false);
    assert.equal(json2.error.code, "BUSINESS_ALREADY_EXISTS");
  });

  // 5. Get business returns business and membership for authenticated user
  it("5. Get business returns business and membership for authenticated user", async () => {
    const { token } = await createTestSession("Rishi Kumar", "rishi@example.com");

    // Create business first
    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
        body: JSON.stringify({
          name: "Rishi Cooling Services",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );

    // Get business
    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "GET",
      headers: { Cookie: `kaamsetu_session=${token}` },
    });

    const res = await getBusinessRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.business.name, "Rishi Cooling Services");
    assert.equal(json.data.member.role, "OWNER");
  });

  // 6. Get business returns 404 when user has no business
  it("6. Get business returns 404 when user has no business", async () => {
    const { token } = await createTestSession("New User", "newuser@example.com");

    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "GET",
      headers: { Cookie: `kaamsetu_session=${token}` },
    });

    const res = await getBusinessRoute(req);
    assert.equal(res.status, 404);

    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error.code, "BUSINESS_NOT_FOUND");
  });

  // 7. Update business succeeds when called by OWNER
  it("7. Update business succeeds when called by OWNER", async () => {
    const { token } = await createTestSession("Rishi Kumar", "rishi@example.com");

    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
        body: JSON.stringify({
          name: "Old Cooling Name",
          phone: "9876543210",
          address: "Old Address",
        }),
      })
    );

    // Update business
    const req = new Request("http://localhost:3000/api/v1/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: JSON.stringify({
        name: "Rishi HVAC Solutions",
        address: "New Headquarters, Delhi",
      }),
    });

    const res = await updateBusinessRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.name, "Rishi HVAC Solutions");
    assert.equal(json.data.address, "New Headquarters, Delhi");
    assert.equal(json.data.phone, "9876543210"); // preserved
  });

  // 8. Update business rejects when called by TECHNICIAN (403)
  it("8. Update business rejects when called by TECHNICIAN (403)", async () => {
    const { token: ownerToken } = await createTestSession("Rishi Owner", "owner@example.com");

    const bizRes = await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );
    const bizJson = await bizRes.json();
    const businessId = bizJson.data.business.id;

    // Create technician user & session
    const { token: techToken, user: techUser } = await createTestSession(
      "Suresh Tech",
      "suresh@example.com"
    );

    // Add technician to member repository directly
    await memberRepository.create({
      businessId,
      userId: techUser.id,
      role: "TECHNICIAN",
      status: "ACTIVE",
      user: {
        id: techUser.id,
        name: techUser.name,
        email: techUser.email,
        phone: techUser.phone,
      },
    });

    // Technician attempts to update business
    const patchReq = new Request("http://localhost:3000/api/v1/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${techToken}` },
      body: JSON.stringify({ name: "Hacked Business Name" }),
    });

    const patchRes = await updateBusinessRoute(patchReq);
    assert.equal(patchRes.status, 403);

    const patchJson = await patchRes.json();
    assert.equal(patchJson.success, false);
    assert.equal(patchJson.error.code, "FORBIDDEN");
  });

  // 9. List members returns all members of the business
  it("9. List members returns all members of the business", async () => {
    const { token } = await createTestSession("Rishi Owner", "owner@example.com");

    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );

    // List members
    const req = new Request("http://localhost:3000/api/v1/business/members", {
      method: "GET",
      headers: { Cookie: `kaamsetu_session=${token}` },
    });

    const res = await listMembersRoute(req);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].role, "OWNER");
    assert.equal(json.data[0].user.email, "owner@example.com");
  });

  // 10. Invite member succeeds when called by OWNER
  it("10. Invite member succeeds when called by OWNER", async () => {
    const { token } = await createTestSession("Rishi Owner", "owner@example.com");

    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );

    // Invite technician
    const req = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: JSON.stringify({
        name: "Suresh Sharma",
        email: "suresh@example.com",
        phone: "9811223344",
        role: "TECHNICIAN",
      }),
    });

    const res = await inviteMemberRoute(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.role, "TECHNICIAN");
    assert.equal(json.data.status, "ACTIVE");
    assert.equal(json.data.user.name, "Suresh Sharma");
    assert.equal(json.data.user.email, "suresh@example.com");
  });

  // 11. Invite member succeeds when called by MANAGER (for technician)
  it("11. Invite member succeeds when called by MANAGER (for technician)", async () => {
    const { token: ownerToken } = await createTestSession("Rishi Owner", "owner@example.com");

    const bizRes = await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );
    const bizJson = await bizRes.json();
    const businessId = bizJson.data.business.id;

    // Create Manager user & session
    const { token: managerToken, user: managerUser } = await createTestSession(
      "Anil Manager",
      "anil@example.com"
    );

    // Register manager membership
    await memberRepository.create({
      businessId,
      userId: managerUser.id,
      role: "MANAGER",
      status: "ACTIVE",
      user: {
        id: managerUser.id,
        name: managerUser.name,
        email: managerUser.email,
        phone: managerUser.phone,
      },
    });

    // Manager invites technician
    const req = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${managerToken}` },
      body: JSON.stringify({
        name: "Rahul Tech",
        email: "rahul@example.com",
        phone: "9822334455",
        role: "TECHNICIAN",
      }),
    });

    const res = await inviteMemberRoute(req);
    assert.equal(res.status, 201);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.role, "TECHNICIAN");
  });

  // 12. Invite member rejects invalid role or duplicate membership
  it("12. Invite member rejects invalid role or duplicate membership", async () => {
    const { token } = await createTestSession("Rishi Owner", "owner@example.com");

    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );

    // Attempt to invite with invalid role
    const invalidRoleReq = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: JSON.stringify({
        name: "Test",
        email: "test@example.com",
        phone: "9876543210",
        role: "INVALID_ROLE",
      }),
    });
    const invalidRes = await inviteMemberRoute(invalidRoleReq);
    assert.equal(invalidRes.status, 400);

    // Attempt to invite existing owner's email (duplicate check)
    const dupReq = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${token}` },
      body: JSON.stringify({
        name: "Rishi Duplicate",
        email: "owner@example.com",
        phone: "9876543210",
        role: "TECHNICIAN",
      }),
    });
    const dupRes = await inviteMemberRoute(dupReq);
    assert.equal(dupRes.status, 409);
    const dupJson = await dupRes.json();
    assert.equal(dupJson.error.code, "MEMBER_ALREADY_EXISTS");
  });

  // 13. Invite member rejects when called by TECHNICIAN (403)
  it("13. Invite member rejects when called by TECHNICIAN (403)", async () => {
    const { token: ownerToken } = await createTestSession("Rishi Owner", "owner@example.com");

    const bizRes = await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );
    const businessId = (await bizRes.json()).data.business.id;

    // Create technician user
    const { token: techToken, user: techUser } = await createTestSession(
      "Suresh Tech",
      "suresh@example.com"
    );

    await memberRepository.create({
      businessId,
      userId: techUser.id,
      role: "TECHNICIAN",
      status: "ACTIVE",
      user: {
        id: techUser.id,
        name: techUser.name,
        email: techUser.email,
        phone: techUser.phone,
      },
    });

    // Technician attempts to invite
    const req = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${techToken}` },
      body: JSON.stringify({
        name: "New Worker",
        email: "newworker@example.com",
        phone: "9899887766",
        role: "TECHNICIAN",
      }),
    });

    const res = await inviteMemberRoute(req);
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.error.code, "FORBIDDEN");
  });

  // 14. Change member role and status succeeds when called by OWNER
  it("14. Change member role and status succeeds when called by OWNER", async () => {
    const { token: ownerToken } = await createTestSession("Rishi Owner", "owner@example.com");

    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
        body: JSON.stringify({
          name: "Rishi Cooling",
          phone: "9876543210",
          address: "Delhi",
        }),
      })
    );

    // Invite technician
    const inviteRes = await inviteMemberRoute(
      new Request("http://localhost:3000/api/v1/business/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
        body: JSON.stringify({
          name: "Suresh Sharma",
          email: "suresh@example.com",
          phone: "9811223344",
          role: "TECHNICIAN",
        }),
      })
    );
    const memberId = (await inviteRes.json()).data.id;

    // Owner promotes technician to MANAGER
    const updateReq = new Request(`http://localhost:3000/api/v1/business/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
      body: JSON.stringify({
        role: "MANAGER",
        status: "ACTIVE",
      }),
    });

    const updateRes = await updateMemberRoute(updateReq, {
      params: Promise.resolve({ id: memberId }),
    });
    assert.equal(updateRes.status, 200);

    const updateJson = await updateRes.json();
    assert.equal(updateJson.success, true);
    assert.equal(updateJson.data.role, "MANAGER");

    // Deactivate member
    const deactReq = new Request(`http://localhost:3000/api/v1/business/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${ownerToken}` },
      body: JSON.stringify({ status: "INACTIVE" }),
    });

    const deactRes = await updateMemberRoute(deactReq, {
      params: Promise.resolve({ id: memberId }),
    });
    assert.equal(deactRes.status, 200);
    assert.equal((await deactRes.json()).data.status, "INACTIVE");
  });

  // 15. Tenant isolation: Member from Business A cannot access or modify Business B
  it("15. Tenant isolation: Member from Business A cannot access or modify Business B", async () => {
    // Owner A creates Business A
    const { token: tokenA } = await createTestSession("Owner A", "ownerA@example.com");
    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${tokenA}` },
        body: JSON.stringify({ name: "Business A", phone: "9876543210", address: "City A" }),
      })
    );

    // Owner B creates Business B
    const { token: tokenB } = await createTestSession("Owner B", "ownerB@example.com");
    await createBusinessRoute(
      new Request("http://localhost:3000/api/v1/business", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${tokenB}` },
        body: JSON.stringify({ name: "Business B", phone: "9811223344", address: "City B" }),
      })
    );

    // Owner B invites a member into Business B
    const inviteBRes = await inviteMemberRoute(
      new Request("http://localhost:3000/api/v1/business/members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${tokenB}` },
        body: JSON.stringify({
          name: "Member B",
          email: "memberb@example.com",
          phone: "9822334455",
          role: "TECHNICIAN",
        }),
      })
    );
    const memberBId = (await inviteBRes.json()).data.id;

    // Owner A attempts to modify member of Business B
    const attackReq = new Request(`http://localhost:3000/api/v1/business/members/${memberBId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `kaamsetu_session=${tokenA}` },
      body: JSON.stringify({ role: "MANAGER" }),
    });

    const attackRes = await updateMemberRoute(attackReq, {
      params: Promise.resolve({ id: memberBId }),
    });

    // Must be rejected with 404 Member Not Found in caller's business
    assert.equal(attackRes.status, 404);
    const attackJson = await attackRes.json();
    assert.equal(attackJson.error.code, "MEMBER_NOT_FOUND");
  });
});
