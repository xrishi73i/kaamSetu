import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { authService } from "../backend/src/modules/auth/auth.service.ts";
import { MockAuthProvider } from "../backend/src/modules/auth/mock-auth.provider.ts";
import { businessRepository } from "../backend/src/modules/business/business.repository.ts";
import { memberRepository } from "../backend/src/modules/members/member.repository.ts";
import { serviceRepository } from "../backend/src/modules/services/service.repository.ts";

import { POST as createBusinessRoute } from "../app/api/v1/business/route.ts";
import { POST as inviteMemberRoute } from "../app/api/v1/business/members/route.ts";

import {
  POST as createServiceRoute,
  GET as listServicesRoute,
} from "../app/api/v1/services/route.ts";
import {
  GET as getServiceRoute,
  PATCH as updateServiceRoute,
  DELETE as deleteServiceRoute,
} from "../app/api/v1/services/[id]/route.ts";

describe("KaamSetu Level 4 - Services Module Tests", () => {
  const authProvider = authService.getProvider() as MockAuthProvider;

  beforeEach(() => {
    authProvider.__resetForTesting();
    businessRepository.__resetForTesting();
    memberRepository.__resetForTesting();
    serviceRepository.__resetForTesting();
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

    const techUser = await authService.signUp({
      name: techName,
      email: techEmail,
      phone: "9811223344",
      password: "Password123!",
    });

    await memberRepository.update(inviteBody.data.id, {
      userId: techUser.id,
    });

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

  // 1. Authenticated user can create a service
  it("1. Authenticated user can create a service", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "AC Deep Cleaning",
        description: "Full foam jet wash for split AC indoor & outdoor units",
        price: 50000, // ₹500 represented as 50000 paise
      }),
    });

    const res = await createServiceRoute(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id.startsWith("srv_"));
    assert.equal(body.data.businessId, owner.business.id);
    assert.equal(body.data.name, "AC Deep Cleaning");
    assert.equal(body.data.description, "Full foam jet wash for split AC indoor & outdoor units");
    assert.equal(body.data.price, 50000);
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
  });

  // 2. Unauthenticated user cannot create a service
  it("2. Unauthenticated user cannot create a service (401)", async () => {
    const req = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "AC Gas Refill",
        price: 250000,
      }),
    });

    const res = await createServiceRoute(req);
    assert.equal(res.status, 401);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "UNAUTHORIZED");
  });

  // 3. Invalid service data is rejected
  it("3. Invalid service data is rejected (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    // Missing name
    const reqNoName = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        price: 50000,
      }),
    });
    const resNoName = await createServiceRoute(reqNoName);
    assert.equal(resNoName.status, 400);
    const bodyNoName = await resNoName.json();
    assert.equal(bodyNoName.error.code, "VALIDATION_ERROR");

    // Missing price
    const reqNoPrice = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "AC Installation",
      }),
    });
    const resNoPrice = await createServiceRoute(reqNoPrice);
    assert.equal(resNoPrice.status, 400);
    const bodyNoPrice = await resNoPrice.json();
    assert.equal(bodyNoPrice.error.code, "VALIDATION_ERROR");
  });

  // 4. Negative price is rejected
  it("4. Negative price is rejected (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "AC Inspection",
        price: -500, // Negative price
      }),
    });

    const res = await createServiceRoute(req);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  // 5. Floating-point price is rejected (must be integer minor units / paise)
  it("5. Floating-point price is rejected (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "AC Filter Wash",
        price: 499.5, // Floating point price
      }),
    });

    const res = await createServiceRoute(req);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.message.includes("minor units"));
  });

  // 6. Authenticated business can list its services
  it("6. Authenticated business can list its services", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    await serviceRepository.create({
      businessId: owner.business.id,
      name: "AC Service Basic",
      price: 39900,
    });
    await serviceRepository.create({
      businessId: owner.business.id,
      name: "AC Service Advanced",
      price: 79900,
    });

    const req = new Request("http://localhost:3000/api/v1/services", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await listServicesRoute(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
  });

  // 7. Business A cannot see Business B's services (Tenant Isolation)
  it("7. Business A cannot see Business B's services", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    await serviceRepository.create({
      businessId: ownerA.business.id,
      name: "AC Repair (Business A)",
      price: 50000,
    });

    await serviceRepository.create({
      businessId: ownerB.business.id,
      name: "RO Repair (Business B)",
      price: 35000,
    });

    // Owner A lists services
    const reqA = new Request("http://localhost:3000/api/v1/services", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });
    const resA = await listServicesRoute(reqA);
    const bodyA = await resA.json();
    assert.equal(bodyA.data.length, 1);
    assert.equal(bodyA.data[0].name, "AC Repair (Business A)");
    assert.equal(bodyA.data[0].businessId, ownerA.business.id);

    // Owner B lists services
    const reqB = new Request("http://localhost:3000/api/v1/services", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerB.token}`,
      },
    });
    const resB = await listServicesRoute(reqB);
    const bodyB = await resB.json();
    assert.equal(bodyB.data.length, 1);
    assert.equal(bodyB.data[0].name, "RO Repair (Business B)");
    assert.equal(bodyB.data[0].businessId, ownerB.business.id);
  });

  // 8. Authenticated business can retrieve its service by ID
  it("8. Authenticated business can retrieve its service by ID", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "Split AC Gas Top-up",
      description: "R32 refrigerant recharge up to 40 PSI",
      price: 150000,
    });

    const req = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await getServiceRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, created.id);
    assert.equal(body.data.name, "Split AC Gas Top-up");
    assert.equal(body.data.price, 150000);
  });

  // 9. Nonexistent service returns the correct error (404)
  it("9. Nonexistent service returns the correct error (404)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/services/srv_nonexistent999", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const res = await getServiceRoute(req, {
      params: Promise.resolve({ id: "srv_nonexistent999" }),
    });
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SERVICE_NOT_FOUND");
  });

  // 10. Business A cannot retrieve Business B's service by ID (404)
  it("10. Business A cannot retrieve Business B's service by ID (404)", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    const serviceB = await serviceRepository.create({
      businessId: ownerB.business.id,
      name: "Commercial Chiller Service",
      price: 1000000,
    });

    // Owner A attempts to view Service of Business B
    const req = new Request(`http://localhost:3000/api/v1/services/${serviceB.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });

    const res = await getServiceRoute(req, {
      params: Promise.resolve({ id: serviceB.id }),
    });
    assert.equal(res.status, 404);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SERVICE_NOT_FOUND");
  });

  // 11. Authorized user can update its service
  it("11. Authorized user can update its service", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "AC Repair (Old Price)",
      price: 40000,
    });

    const req = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        name: "AC Repair (Revised Rate)",
        price: 55000,
        description: "Diagnose electrical faults, PCB repairs, and fan capacitor swap",
      }),
    });

    const res = await updateServiceRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.name, "AC Repair (Revised Rate)");
    assert.equal(body.data.price, 55000);
    assert.equal(body.data.description, "Diagnose electrical faults, PCB repairs, and fan capacitor swap");
  });

  // 12. Unauthorized user (TECHNICIAN) cannot update a service (403)
  it("12. Unauthorized user cannot update a service (403)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(owner.token, "Suresh Tech", "suresh@example.com");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "Standard AC Service",
      price: 49900,
    });

    // Technician attempts to update service price
    const req = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${tech.token}`,
      },
      body: JSON.stringify({
        price: 10000,
      }),
    });

    const res = await updateServiceRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 403);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 13. Protected businessId cannot be changed by the client
  it("13. Protected businessId cannot be changed by the client (400)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "Original Service",
      price: 30000,
    });

    // Client attempts to tamper with businessId in PATCH
    const req = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${owner.token}`,
      },
      body: JSON.stringify({
        businessId: "biz_tampered123",
        name: "Tampered Service",
      }),
    });

    const res = await updateServiceRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  // 14. Authorized user can delete its service
  it("14. Authorized user can delete its service", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "Deprecated Service Offering",
      price: 10000,
    });

    const deleteReq = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });

    const deleteRes = await deleteCustomerOrService(deleteReq, created.id);
    assert.equal(deleteRes.status, 200);

    const deleteBody = await deleteRes.json();
    assert.equal(deleteBody.success, true);
    assert.equal(deleteBody.data.deleted, true);

    // Verify subsequent lookup returns 404
    const getReq = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${owner.token}`,
      },
    });
    const getRes = await getServiceRoute(getReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(getRes.status, 404);
  });

  // Helper for delete call
  function deleteCustomerOrService(req: Request, id: string) {
    return deleteServiceRoute(req, { params: Promise.resolve({ id }) });
  }

  // 15. Business A cannot delete Business B's service (404)
  it("15. Business A cannot delete Business B's service (404)", async () => {
    const ownerA = await createBusinessOwner("Owner A", "owner.a@example.com", "Business A");
    const ownerB = await createBusinessOwner("Owner B", "owner.b@example.com", "Business B");

    const serviceB = await serviceRepository.create({
      businessId: ownerB.business.id,
      name: "Protected Service of B",
      price: 80000,
    });

    // Owner A attempts to delete Service of Business B
    const deleteReq = new Request(`http://localhost:3000/api/v1/services/${serviceB.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${ownerA.token}`,
      },
    });

    const deleteRes = await deleteServiceRoute(deleteReq, {
      params: Promise.resolve({ id: serviceB.id }),
    });
    assert.equal(deleteRes.status, 404);

    // Service still exists in Business B
    const verifyExists = await serviceRepository.findById(ownerB.business.id, serviceB.id);
    assert.ok(verifyExists);
    assert.equal(verifyExists.name, "Protected Service of B");
  });

  // 16. Unauthorized user (TECHNICIAN) cannot delete a service (403)
  it("16. Unauthorized user cannot delete a service (403)", async () => {
    const owner = await createBusinessOwner("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(owner.token, "Suresh Tech", "suresh@example.com");

    const created = await serviceRepository.create({
      businessId: owner.business.id,
      name: "Service Safe From Tech",
      price: 50000,
    });

    // Technician attempts to delete
    const deleteReq = new Request(`http://localhost:3000/api/v1/services/${created.id}`, {
      method: "DELETE",
      headers: {
        Cookie: `kaamsetu_session=${tech.token}`,
      },
    });

    const deleteRes = await deleteServiceRoute(deleteReq, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(deleteRes.status, 403);

    const body = await deleteRes.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });
});
