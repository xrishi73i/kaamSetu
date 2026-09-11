import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { authService } from "../backend/src/modules/auth/auth.service.ts";
import { MockAuthProvider } from "../backend/src/modules/auth/mock-auth.provider.ts";
import { businessRepository } from "../backend/src/modules/business/business.repository.ts";
import { memberRepository } from "../backend/src/modules/members/member.repository.ts";
import { customerRepository } from "../backend/src/modules/customers/customer.repository.ts";
import { serviceRepository } from "../backend/src/modules/services/service.repository.ts";
import { jobRepository } from "../backend/src/modules/jobs/job.repository.ts";

import { POST as createBusinessRoute } from "../app/api/v1/business/route.ts";
import { POST as inviteMemberRoute } from "../app/api/v1/business/members/route.ts";

import {
  POST as createJobRoute,
  GET as listJobsRoute,
} from "../app/api/v1/jobs/route.ts";
import {
  GET as getJobRoute,
  PATCH as updateJobRoute,
} from "../app/api/v1/jobs/[id]/route.ts";
import { POST as assignJobRoute } from "../app/api/v1/jobs/[id]/assign/route.ts";
import { POST as startJobRoute } from "../app/api/v1/jobs/[id]/start/route.ts";
import { POST as completeJobRoute } from "../app/api/v1/jobs/[id]/complete/route.ts";
import { POST as cancelJobRoute } from "../app/api/v1/jobs/[id]/cancel/route.ts";

describe("KaamSetu Level 5 - Jobs Module Tests", () => {
  const authProvider = authService.getProvider() as MockAuthProvider;

  beforeEach(() => {
    authProvider.__resetForTesting();
    businessRepository.__resetForTesting();
    memberRepository.__resetForTesting();
    customerRepository.__resetForTesting();
    serviceRepository.__resetForTesting();
    jobRepository.__resetForTesting();
  });

  // Helper to register an owner, create a business, a customer, and a service
  async function setupBusinessEnvironment(
    ownerName: string,
    ownerEmail: string,
    bizName: string
  ) {
    const user = await authService.signUp({
      name: ownerName,
      email: ownerEmail,
      phone: "9876543210",
      password: "Password123!",
    });

    const session = await authService.signIn({
      email: ownerEmail,
      password: "Password123!",
    });

    const bizReq = new Request("http://localhost:3000/api/v1/business", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${session.token}`,
      },
      body: JSON.stringify({
        name: bizName,
        phone: "9876543210",
        address: "Industrial Area, New Delhi",
      }),
    });

    const bizRes = await createBusinessRoute(bizReq);
    const bizBody = await bizRes.json();
    const business = bizBody.data.business;
    const member = bizBody.data.member;

    // Create a customer
    const customer = await customerRepository.create({
      businessId: business.id,
      name: "Sunil Verma",
      phone: "9876543210",
      address: "B-42 Defence Colony, New Delhi",
    });

    // Create a service
    const service = await serviceRepository.create({
      businessId: business.id,
      name: "AC Deep Cleaning",
      price: 50000,
    });

    return {
      user,
      token: session.token,
      business,
      member,
      customer,
      service,
    };
  }

  let techPhoneCounter = 1000;
  // Helper to add a technician to an existing business
  async function createTechnician(
    ownerToken: string,
    techName: string,
    techEmail: string,
    customPhone?: string
  ) {
    const techPhone = customPhone || `9811${String(techPhoneCounter++).padStart(6, "0")}`;
    const inviteReq = new Request("http://localhost:3000/api/v1/business/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${ownerToken}`,
      },
      body: JSON.stringify({
        name: techName,
        email: techEmail,
        phone: techPhone,
        role: "TECHNICIAN",
      }),
    });
    const inviteRes = await inviteMemberRoute(inviteReq);
    const inviteBody = await inviteRes.json();

    const techUser = await authService.signUp({
      name: techName,
      email: techEmail,
      phone: techPhone,
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

  // 1. Authorized user can create Job
  it("1. Authorized user can create Job", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        customerId: env.customer.id,
        serviceId: env.service.id,
        title: "Split AC Servicing",
        description: "Customer reports reduced cooling airflow",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 201);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id.startsWith("job_"));
    assert.equal(body.data.businessId, env.business.id);
    assert.equal(body.data.customerId, env.customer.id);
    assert.equal(body.data.serviceId, env.service.id);
    assert.equal(body.data.title, "Split AC Servicing");
    assert.equal(body.data.status, "CREATED");
    assert.ok(body.data.createdAt);
  });

  // 2. Unauthenticated user is rejected (401)
  it("2. Unauthenticated user is rejected (401)", async () => {
    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: "cust_123",
        serviceId: "srv_123",
        title: "Test Job",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.code, "UNAUTHORIZED");
  });

  // 3. Invalid input is rejected (400)
  it("3. Invalid input is rejected (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        // Missing customerId and serviceId
        title: "Incomplete Job",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  // 4. Invalid Customer is rejected (404)
  it("4. Invalid Customer is rejected (404)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        customerId: "cust_nonexistent999",
        serviceId: env.service.id,
        title: "Split AC Servicing",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "CUSTOMER_NOT_FOUND");
  });

  // 5. Invalid Service is rejected (404)
  it("5. Invalid Service is rejected (404)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        customerId: env.customer.id,
        serviceId: "srv_nonexistent999",
        title: "Split AC Servicing",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "SERVICE_NOT_FOUND");
  });

  // 6. Customer from another Business is rejected (404)
  it("6. Customer from another Business is rejected (404)", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");

    // Owner A attempts to create Job using Customer of Business B
    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${envA.token}`,
      },
      body: JSON.stringify({
        customerId: envB.customer.id, // Foreign customer
        serviceId: envA.service.id,
        title: "Illegal Cross-Tenant Job",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "CUSTOMER_NOT_FOUND");
  });

  // 7. Service from another Business is rejected (404)
  it("7. Service from another Business is rejected (404)", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");

    // Owner A attempts to create Job using Service of Business B
    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${envA.token}`,
      },
      body: JSON.stringify({
        customerId: envA.customer.id,
        serviceId: envB.service.id, // Foreign service
        title: "Illegal Cross-Tenant Job",
      }),
    });

    const res = await createJobRoute(req);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "SERVICE_NOT_FOUND");
  });

  // 8. Client cannot control protected businessId
  it("8. Client cannot control protected businessId (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const createdJob = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Legitimate Job",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${createdJob.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        businessId: "biz_tampered999",
        title: "Tampered Job",
      }),
    });

    const res = await updateJobRoute(req, {
      params: Promise.resolve({ id: createdJob.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  // 9. Authorized user can list Jobs
  it("9. Authorized user can list Jobs", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job Alpha",
      status: "CREATED",
    });
    await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job Beta",
      status: "ASSIGNED",
    });

    const req = new Request("http://localhost:3000/api/v1/jobs", {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${env.token}`,
      },
    });

    const res = await listJobsRoute(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.length, 2);
  });

  // 10. Authorized user can retrieve own Job
  it("10. Authorized user can retrieve own Job", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Target Job",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${created.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${env.token}`,
      },
    });

    const res = await getJobRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.id, created.id);
    assert.equal(body.data.title, "Target Job");
  });

  // 11. Another Business cannot retrieve the Job (404)
  it("11. Another Business cannot retrieve the Job (404)", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");

    const jobB = await jobRepository.create({
      businessId: envB.business.id,
      customerId: envB.customer.id,
      serviceId: envB.service.id,
      title: "Private Job of B",
      status: "CREATED",
    });

    // Owner A attempts to fetch Job of Business B
    const req = new Request(`http://localhost:3000/api/v1/jobs/${jobB.id}`, {
      method: "GET",
      headers: {
        Cookie: `kaamsetu_session=${envA.token}`,
      },
    });

    const res = await getJobRoute(req, {
      params: Promise.resolve({ id: jobB.id }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "JOB_NOT_FOUND");
  });

  // 12. Authorized update succeeds
  it("12. Authorized update succeeds", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const created = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Initial Title",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        title: "Updated Title",
        description: "New operational notes",
      }),
    });

    const res = await updateJobRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.title, "Updated Title");
    assert.equal(body.data.description, "New operational notes");
  });

  // 13. Unauthorized update is rejected (403)
  it("13. Unauthorized update is rejected (403)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Suresh Tech", "suresh@example.com");

    const created = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Initial Title",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${tech.token}`,
      },
      body: JSON.stringify({
        title: "Malicious Edit",
      }),
    });

    const res = await updateJobRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 14. Another Business cannot update Job (404)
  it("14. Another Business cannot update Job (404)", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");

    const jobB = await jobRepository.create({
      businessId: envB.business.id,
      customerId: envB.customer.id,
      serviceId: envB.service.id,
      title: "Job of B",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${jobB.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${envA.token}`,
      },
      body: JSON.stringify({
        title: "Hacked by A",
      }),
    });

    const res = await updateJobRoute(req, {
      params: Promise.resolve({ id: jobB.id }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "JOB_NOT_FOUND");
  });

  // 15. Valid technician assignment succeeds (CREATED → ASSIGNED)
  it("15. Valid technician assignment succeeds (CREATED → ASSIGNED)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Suresh Tech", "suresh@example.com");

    const created = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job to Assign",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${created.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        technicianId: tech.memberId,
      }),
    });

    const res = await assignJobRoute(req, {
      params: Promise.resolve({ id: created.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, "ASSIGNED");
    assert.equal(body.data.technicianId, tech.memberId);
  });

  // 16. Technician from another Business is rejected (404)
  it("16. Technician from another Business is rejected (404)", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");
    const techB = await createTechnician(envB.token, "Tech of B", "techb@example.com");

    const jobA = await jobRepository.create({
      businessId: envA.business.id,
      customerId: envA.customer.id,
      serviceId: envA.service.id,
      title: "Job of A",
      status: "CREATED",
    });

    // Owner A attempts to assign Technician belonging to Business B
    const req = new Request(`http://localhost:3000/api/v1/jobs/${jobA.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${envA.token}`,
      },
      body: JSON.stringify({
        technicianId: techB.memberId,
      }),
    });

    const res = await assignJobRoute(req, {
      params: Promise.resolve({ id: jobA.id }),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "MEMBER_NOT_FOUND");
  });

  // 17. Unauthorized assignment is rejected (403)
  it("17. Unauthorized assignment is rejected (403)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech1 = await createTechnician(env.token, "Tech 1", "tech1@example.com");
    const tech2 = await createTechnician(env.token, "Tech 2", "tech2@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job",
      status: "CREATED",
    });

    // Technician attempts to assign another technician
    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${tech1.token}`,
      },
      body: JSON.stringify({
        technicianId: tech2.memberId,
      }),
    });

    const res = await assignJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 18. Invalid state assignment is rejected (400)
  it("18. Invalid state assignment is rejected (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Tech", "tech@example.com");

    const completedJob = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Completed Job",
      status: "COMPLETED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${completedJob.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        technicianId: tech.memberId,
      }),
    });

    const res = await assignJobRoute(req, {
      params: Promise.resolve({ id: completedJob.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "INVALID_STATE_TRANSITION");
  });

  // 19. Valid Job can start (ASSIGNED → IN_PROGRESS)
  it("19. Valid Job can start (ASSIGNED → IN_PROGRESS)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Assigned Tech", "assigned@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Ready Job",
      technicianId: tech.memberId,
      status: "ASSIGNED",
    });

    // Assigned technician starts the job
    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/start`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${tech.token}`,
      },
    });

    const res = await startJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, "IN_PROGRESS");
    assert.ok(body.data.startedAt);
  });

  // 20. Invalid state transition to start is rejected (400)
  it("20. Invalid state transition to start is rejected (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    // Job is still in CREATED state without assigned technician
    const unassignedJob = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Unassigned Job",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${unassignedJob.id}/start`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${env.token}`,
      },
    });

    const res = await startJobRoute(req, {
      params: Promise.resolve({ id: unassignedJob.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "INVALID_STATE_TRANSITION");
  });

  // 21. Unauthorized user to start is rejected (403)
  it("21. Unauthorized user to start is rejected (403)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const assignedTech = await createTechnician(env.token, "Assigned Tech", "assigned@example.com");
    const otherTech = await createTechnician(env.token, "Other Tech", "other@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Specific Job",
      technicianId: assignedTech.memberId,
      status: "ASSIGNED",
    });

    // An unassigned technician tries to start another tech's job
    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/start`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${otherTech.token}`,
      },
    });

    const res = await startJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 22. Valid Job can complete (IN_PROGRESS → COMPLETED)
  it("22. Valid Job can complete (IN_PROGRESS → COMPLETED)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Working Tech", "working@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "In Progress Job",
      technicianId: tech.memberId,
      status: "IN_PROGRESS",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/complete`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${tech.token}`,
      },
    });

    const res = await completeJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, "COMPLETED");
    assert.ok(body.data.completedAt);
  });

  // 23. Invalid state transition to complete is rejected (400)
  it("23. Invalid state transition to complete is rejected (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    // Cannot complete directly from CREATED
    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Created Job",
      status: "CREATED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/complete`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${env.token}`,
      },
    });

    const res = await completeJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "INVALID_STATE_TRANSITION");
  });

  // 24. Unauthorized user to complete is rejected (403)
  it("24. Unauthorized user to complete is rejected (403)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const assignedTech = await createTechnician(env.token, "Assigned Tech", "assigned@example.com");
    const otherTech = await createTechnician(env.token, "Other Tech", "other@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "In Progress Job",
      technicianId: assignedTech.memberId,
      status: "IN_PROGRESS",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/complete`, {
      method: "POST",
      headers: {
        Cookie: `kaamsetu_session=${otherTech.token}`,
      },
    });

    const res = await completeJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 25. Valid cancellation succeeds (from CREATED, ASSIGNED, or IN_PROGRESS → CANCELLED)
  it("25. Valid cancellation succeeds", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job to Cancel",
      status: "ASSIGNED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        reason: "Customer rescheduled to next month",
      }),
    });

    const res = await cancelJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, "CANCELLED");
    assert.ok(body.data.cancelledAt);
    assert.equal(body.data.cancellationReason, "Customer rescheduled to next month");
  });

  // 26. Invalid cancellation rejected (COMPLETED job cannot be cancelled) (400)
  it("26. Invalid cancellation rejected (400)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");

    const completedJob = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Finished Job",
      status: "COMPLETED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${completedJob.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${env.token}`,
      },
      body: JSON.stringify({
        reason: "Attempt to cancel finished job",
      }),
    });

    const res = await cancelJobRoute(req, {
      params: Promise.resolve({ id: completedJob.id }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "INVALID_STATE_TRANSITION");
  });

  // 27. Unauthorized user cannot cancel (403)
  it("27. Unauthorized user cannot cancel (403)", async () => {
    const env = await setupBusinessEnvironment("Rishi Owner", "rishi@example.com", "Rishi HVAC");
    const tech = await createTechnician(env.token, "Tech", "tech@example.com");

    const job = await jobRepository.create({
      businessId: env.business.id,
      customerId: env.customer.id,
      serviceId: env.service.id,
      title: "Job",
      status: "ASSIGNED",
    });

    const req = new Request(`http://localhost:3000/api/v1/jobs/${job.id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `kaamsetu_session=${tech.token}`,
      },
      body: JSON.stringify({
        reason: "Tech attempt cancel",
      }),
    });

    const res = await cancelJobRoute(req, {
      params: Promise.resolve({ id: job.id }),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, "FORBIDDEN");
  });

  // 28. Strict Tenant Isolation: Business A cannot access or mutate Business B's Job
  it("28. Strict Tenant Isolation: Business A cannot access or mutate Business B's Job", async () => {
    const envA = await setupBusinessEnvironment("Owner A", "ownera@example.com", "Business A");
    const envB = await setupBusinessEnvironment("Owner B", "ownerb@example.com", "Business B");

    const jobB = await jobRepository.create({
      businessId: envB.business.id,
      customerId: envB.customer.id,
      serviceId: envB.service.id,
      title: "Exclusive Job of B",
      status: "ASSIGNED",
    });

    // 1. Business A cannot start Job B
    const startReq = new Request(`http://localhost:3000/api/v1/jobs/${jobB.id}/start`, {
      method: "POST",
      headers: { Cookie: `kaamsetu_session=${envA.token}` },
    });
    const startRes = await startJobRoute(startReq, { params: Promise.resolve({ id: jobB.id }) });
    assert.equal(startRes.status, 404);

    // 2. Business A cannot complete Job B
    const completeReq = new Request(`http://localhost:3000/api/v1/jobs/${jobB.id}/complete`, {
      method: "POST",
      headers: { Cookie: `kaamsetu_session=${envA.token}` },
    });
    const completeRes = await completeJobRoute(completeReq, { params: Promise.resolve({ id: jobB.id }) });
    assert.equal(completeRes.status, 404);

    // 3. Business A cannot cancel Job B
    const cancelReq = new Request(`http://localhost:3000/api/v1/jobs/${jobB.id}/cancel`, {
      method: "POST",
      headers: { Cookie: `kaamsetu_session=${envA.token}` },
    });
    const cancelRes = await cancelJobRoute(cancelReq, { params: Promise.resolve({ id: jobB.id }) });
    assert.equal(cancelRes.status, 404);
  });
});
