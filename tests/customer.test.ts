import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { authService } from "../backend/src/modules/auth/auth.service.ts";
import { MockAuthProvider } from "../backend/src/modules/auth/mock-auth.provider.ts";
import { businessRepository } from "../backend/src/modules/business/business.repository.ts";
import { memberRepository } from "../backend/src/modules/members/member.repository.ts";
import { customerRepository } from "../backend/src/modules/customers/customer.repository.ts";

import {
  POST as createBusinessRoute,
} from "../app/api/v1/business/route.ts";
import {
  POST as inviteMemberRoute,
} from "../app/api/v1/business/members/route.ts";

import {
  POST as createCustomerRoute,
  GET as listCustomersRoute,
} from "../app/api/v1/customers/route.ts";
import {
  GET as getCustomerRoute,
  PATCH as updateCustomerRoute,
  DELETE as deleteCustomerRoute,
} from "../app/api/v1/customers/[id]/route.ts";

describe("KaamSetu Level 3 - Customers Module Tests", () => {
  const authProvider = authService.getProvider() as MockAuthProvider;

  beforeEach(() => {
    authProvider.__resetForTesting();
    businessRepository.__resetForTesting();
    memberRepository.__resetForTesting();
    customerRepository.__resetForTesting();
  });

  // Helper to register and sign in a user, establish a business, and return session token & IDs
  async function createBusinessOwner(
    userName: string,
    userEmail: string,
    businessName: string
  ) {
    const user = await authService.signUp({
      name: userName,
      email: userEmail,
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: userEmail,
      password: "Password123!",
    });

    const bizReq = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${session.token}`,
      },
      body: JSON.stringify({
        name: businessName,
        phone: "9876543210",
        address: "Industrial Area, New Delhi",
      }),
    });

    const bizRes = await createBusinessRoute(bizReq);
    const bizBody = await bizRes.json();

    return {
      user,
      token: session.token,
      business: bizBody.data.business,
      member: bizBody.data.member,
    };
  }

  // Helper to add a technician to an existing business
  async function createTechnician(
    ownerToken: string,
    techName: string,
    techEmail: string
  ) {
    // 1. Invite technician via member route
    const inviteReq = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${ownerToken}`,
      },
      body: JSON.stringify({
        name: techName,
        email: techEmail,
        phone: "9811223344",
        role: "TECHNICIAN",
      }),
    });
    const inviteRes = await inviteMemberRoute(inviteReq);
    const inviteBody = await inviteRes.json();

    // 2. Register user account for technician with matching email & phone
    const techUser = await authService.signUp({
      name: techName,
      email: techEmail,
      phone: "9811223344",
      password: "Password123!",
    });

    // 3. Link the member record to the actual user account ID
    await memberRepository.update(inviteBody.data.id, {
      userId: techUser.id,
    });

    // 4. Sign in as technician
    const techSession = await authService.signIn({
      email: techEmail,
      password: "Password123!",
    });

    return {
      user: techUser,
      token: techSession.token,
      memberId: inviteBody.data.id,
    };
  }

  // 1. Authenticated user can create a customer
  it("1. Authenticated user can create a customer", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "Sunil Verma",
        phone: "9876543210",
        email: "sunil@example.com",
        address: "B-42 Defence Colony, New Delhi",
      }),
    });

    const res = await createCustomerRoute(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id.startsWith("cust_"));
    assert.equal(body.data.businessId, owner.business.id);
    assert.equal(body.data.name, "Sunil Verma");
    assert.equal(body.data.phone, "9876543210");
    assert.equal(body.data.email, "sunil@example.com");
    assert.equal(body.data.address, "B-42 Defence Colony, New Delhi");
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
  });

  // 2. Unauthenticated user cannot create a customer
  it("2. Unauthenticated user cannot create a customer (401)", async () => {
    const req = new Request("http://localhost:3000/api/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Sunil Verma",
        phone: "9876543210",
      }),
    });

    const res = await createCustomerRoute(req);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "UNAUTHORIZED");
  });

  // 3. Invalid customer data is rejected
  it("3. Invalid customer data is rejected (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    // Missing name
    const reqNoName = new Request("http://localhost:3000/api/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        phone: "9876543210",
      }),
    });
    const resNoName = await createCustomerRoute(reqNoName);
    assert.equal(resNoName.status, 400);
    const bodyNoName = await resNoName.json();
    assert.equal(bodyNoName.error.code, "VALIDATION_ERROR");

    // Invalid phone number format
    const reqBadPhone = new Request("http://localhost:3000/api/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "Sunil Verma",
        phone: "12345", // Invalid Indian mobile
      }),
    });
    const resBadPhone = await createCustomerRoute(reqBadPhone);
    assert.equal(resBadPhone.status, 400);
    const bodyBadPhone = await resBadPhone.json();
    assert.equal(bodyBadPhone.error.code, "VALIDATION_ERROR");

    // Invalid email format
    const reqBadEmail = new Request("http://localhost:3000/api/v1/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "Sunil Verma",
        phone: "9876543210",
        email: "not-an-email",
      }),
    });
    const resBadEmail = await createCustomerRoute(reqBadEmail);
    assert.equal(resBadEmail.status, 400);
    const bodyBadEmail = await resBadEmail.json();
    assert.equal(bodyBadEmail.error.code, "VALIDATION_ERROR");
  });

  // 4. Authenticated business can list its customers
  it("4. Authenticated business can list its customers", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    // Create two customers
    await customerRepository.create({
      businessId: owner.business.id,
      name: "Customer Alpha",
      phone: "9876543210",
    });
    await customerRepository.create({
      businessId: owner.business.id,
      name: "Customer Beta",
      phone: "9811223344",
    });

    const req = new Request("http://localhost:3000/api/v1/customers", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await listCustomersRoute(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
  });

  // 5. Business A cannot see Business B's customers (Tenant Isolation)
  it("5. Business A cannot see Business B's customers", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    // Create customers for Business A
    await customerRepository.create({
      businessId: ownerA.business.id,
      name: "Customer of A",
      phone: "9876543210",
    });

    // Create customers for Business B
    await customerRepository.create({
      businessId: ownerB.business.id,
      name: "Customer of B",
      phone: "9988776655",
    });

    // Owner A requests customers list
    const reqA = new Request("http://localhost:3000/api/v1/customers", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });
    const resA = await listCustomersRoute(reqA);
    const bodyA = await resA.json();
    assert.equal(bodyA.data.length, 1);
    assert.equal(bodyA.data[0].name, "Customer of A");
    assert.equal(bodyA.data[0].businessId, ownerA.business.id);

    // Owner B requests customers list
    const reqB = new Request("http://localhost:3000/api/v1/customers", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerB.token}`,
      },
    });
    const resB = await listCustomersRoute(reqB);
    const bodyB = await resB.json();
    assert.equal(bodyB.data.length, 1);
    assert.equal(bodyB.data[0].name, "Customer of B");
    assert.equal(bodyB.data[0].businessId, ownerB.business.id);
  });

  // 6. Authenticated business can get one of its customers by ID
  it("6. Authenticated business can get one of its customers by ID", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Pooja Sharma",
      phone: "9812345678",
      email: "pooja@example.com",
    });

    const req = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await getCustomerRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, created.id);
    assert.equal(body.data.name, "Pooja Sharma");
  });

  // 7. Nonexistent customer returns 404
  it("7. Nonexistent customer returns 404", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/customers/cust_nonexistent999", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await getCustomerRoute(req, {
      params: Promise.resolve({ id: "cust_nonexistent999" }),
    });
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "CUSTOMER_NOT_FOUND");
  });

  // 8. Business A cannot access Business B's customer by ID
  it("8. Business A cannot access Business B's customer by ID (404)", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    const customerB = await customerRepository.create({
      businessId: ownerB.business.id,
      name: "Private Customer of B",
      phone: "9988776655",
    });

    // Owner A attempts to get Customer of Business B
    const req = new Request(`http://localhost:3000/api/v1/customers/${customerB.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });

    const res = await getCustomerRoute(req, {
      params: Promise.resolve({ id: customerB.id }),
    });
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "CUSTOMER_NOT_FOUND");
  });

  // 9. Authorized user can update an owned customer
  it("9. Authorized user can update an owned customer", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Rahul Mehra",
      phone: "9876543210",
      address: "Old Address, Saket",
    });

    const req = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "Rahul Mehra (Updated)",
        address: "New Address, Hauz Khas",
      }),
    });

    const res = await updateCustomerRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, "Rahul Mehra (Updated)");
    assert.equal(body.data.address, "New Address, Hauz Khas");
    assert.equal(body.data.phone, "9876543210"); // Unchanged
  });

  // 10. Unauthorized user (TECHNICIAN) cannot update a customer (403)
  it("10. Unauthorized user cannot update a customer (403)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(owner.token, "Suresh Tech", "suresh@example.com");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Anil Kapoor",
      phone: "9876543210",
    });

    // Technician attempts to update customer
    const req = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${tech.token}`,
      },
      body: JSON.stringify({
        name: "Malicious Edit",
      }),
    });

    const res = await updateCustomerRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 403);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 11. Authorized user can delete an owned customer
  it("11. Authorized user can delete an owned customer", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Customer To Delete",
      phone: "9876543210",
    });

    const deleteReq = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const deleteRes = await deleteCustomerRoute(deleteReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(deleteRes.status, 200);

    const deleteBody = await deleteRes.json();
    assert.equal(deleteBody.success, true);
    assert.equal(deleteBody.data.deleted, true);

    // Verify subsequent lookup returns 404
    const getReq = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });
    const getRes = await getCustomerRoute(getReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(getRes.status, 404);
  });

  // 12. Business A cannot delete Business B's customer
  it("12. Business A cannot delete Business B's customer (404)", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    const customerB = await customerRepository.create({
      businessId: ownerB.business.id,
      name: "Protected Customer of B",
      phone: "9988776655",
    });

    // Owner A attempts to delete Customer of Business B
    const deleteReq = new Request(`http://localhost:3000/api/v1/customers/${customerB.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });

    const deleteRes = await deleteCustomerRoute(deleteReq, {
      params: Promise.resolve({ id: customerB.id }),
    });
    assert.equal(deleteRes.status, 404);

    // Customer still exists in Business B
    const verifyExists = await customerRepository.findById(ownerB.business.id, customerB.id);
    assert.ok(verifyExists);
    assert.equal(verifyExists.name, "Protected Customer of B");
  });

  // 13. Unauthorized user (TECHNICIAN) cannot delete a customer (403)
  it("13. Unauthorized user cannot delete a customer (403)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(owner.token, "Suresh Tech", "suresh@example.com");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Customer Safe From Tech",
      phone: "9876543210",
    });

    // Technician attempts to delete
    const deleteReq = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${tech.token}`,
      },
    });

    const deleteRes = await deleteCustomerRoute(deleteReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(deleteRes.status, 403);
    const body = await deleteRes.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 14. Patch rejects empty or invalid update data (400)
  it("14. Patch rejects empty or invalid update data (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await customerRepository.create({
      businessId: owner.business.id,
      name: "Test Customer",
      phone: "9876543210",
    });

    // Empty update body
    const emptyReq = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({}),
    });
    const emptyRes = await updateCustomerRoute(emptyReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(emptyRes.status, 400);

    // Invalid phone update
    const badPhoneReq = new Request(`http://localhost:3000/api/v1/customers/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        phone: "invalid-phone",
      }),
    });
    const badPhoneRes = await updateCustomerRoute(badPhoneReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(badPhoneRes.status, 400);
  });
});
