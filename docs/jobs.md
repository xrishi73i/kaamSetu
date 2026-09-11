# KaamSetu — Level 5: Jobs Architecture

This document details the architectural design, API specifications, authorization matrix, lifecycle state transitions, cross-entity validation rules, database mapping, and testing strategy for **Level 5 (Jobs)** of KaamSetu.

---

## 1. Purpose of Level 5

In KaamSetu's core lifecycle for local service businesses (e.g. AC service and repair):
```
Customer → Job → Technician → Work → Quotation → Invoice → Payment → History → Repeat Service
```

- Level 1 established human identity (`AuthUser`).
- Level 2 established multi-tenant service business structure (`Business` and `BusinessMember`).
- Level 3 established client directory (`Customer`).
- Level 4 established service offerings catalog (`ServiceOffering`).
- **Level 5 establishes Jobs** — the central operational work order entity tying together the **Customer**, the requested **Service**, the assigned **Technician**, and the service execution lifecycle.

### Multi-Tenant Hierarchy
```
Business (biz_...) [Tenant Partition]
 ├── Members (mem_...) [Staff & Technicians]
 ├── Customers (cust_...) [Clients & Addresses]
 ├── Services (srv_...) [Catalog Offerings]
 └── Jobs (job_...) [Operational Work Orders]
```

Every job belongs to **exactly one Business**. Cross-tenant reference, creation, or mutation is strictly forbidden.

---

## 2. Job Domain Model

### Data Model (`backend/src/modules/jobs/job.types.ts`)
```typescript
export type JobStatus =
  | "CREATED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Job {
  id: string;             // Prefix: job_
  businessId: string;     // Multi-tenant business partition
  customerId: string;     // Reference to customer (cust_...)
  serviceId: string;      // Reference to service offering (srv_...)
  technicianId?: string;  // Reference to business member (mem_...)
  status: JobStatus;      // Current state in lifecycle
  title: string;          // Short description of the work order
  description?: string;   // Detailed problem report / instructions
  createdAt: string;      // ISO 8601 timestamp
  updatedAt: string;      // ISO 8601 timestamp
  assignedAt?: string;    // ISO 8601 timestamp
  startedAt?: string;     // ISO 8601 timestamp
  completedAt?: string;   // ISO 8601 timestamp
  cancelledAt?: string;   // ISO 8601 timestamp
  cancellationReason?: string;
}
```

### Data Transfer Objects (DTOs)
```typescript
export interface CreateJobDto {
  customerId: string;
  serviceId: string;
  technicianId?: string; // Optional at creation
  title: string;
  description?: string;
}

export interface UpdateJobDto {
  title?: string;
  description?: string;
  businessId?: never; // Protected field
  id?: never;         // Protected field
  customerId?: never; // Protected field
  serviceId?: never;  // Protected field
  status?: never;     // State machine protected
}

export interface AssignTechnicianDto {
  technicianId: string;
}

export interface CancelJobDto {
  reason?: string;
}
```

---

## 3. Strict State Machine & Lifecycle Transitions

The Job lifecycle follows strict directed transitions:

```
          [Create]
             │
             ▼
        ┌─────────┐
        │ CREATED │─────────────┐
        └─────────┘             │
             │                  │
      [Assign Technician]       │
             │                  │
             ▼                  │
        ┌──────────┐            │
        │ ASSIGNED │────────────┼───────► [Cancel]
        └──────────┘            │            │
             │                  │            ▼
       [Start Work]             │       ┌───────────┐
             │                  │       │ CANCELLED │
             ▼                  │       └───────────┘
       ┌─────────────┐          │        (TERMINAL)
       │ IN_PROGRESS │──────────┘
       └─────────────┘
             │
      [Complete Work]
             │
             ▼
       ┌───────────┐
       │ COMPLETED │
       └───────────┘
        (TERMINAL)
```

### Transition Matrix
| Current State | Allowed Next State | Action / Endpoint | Required Caller Role |
|---|---|---|---|
| `CREATED` | `ASSIGNED` | `POST /jobs/:id/assign` | `OWNER`, `MANAGER` |
| `ASSIGNED` | `ASSIGNED` | `POST /jobs/:id/assign` (Reassign) | `OWNER`, `MANAGER` |
| `ASSIGNED` | `IN_PROGRESS` | `POST /jobs/:id/start` | `OWNER`, `MANAGER`, or assigned `TECHNICIAN` |
| `IN_PROGRESS` | `COMPLETED` | `POST /jobs/:id/complete` | `OWNER`, `MANAGER`, or assigned `TECHNICIAN` |
| `CREATED` | `CANCELLED` | `POST /jobs/:id/cancel` | `OWNER`, `MANAGER` |
| `ASSIGNED` | `CANCELLED` | `POST /jobs/:id/cancel` | `OWNER`, `MANAGER` |
| `IN_PROGRESS` | `CANCELLED` | `POST /jobs/:id/cancel` | `OWNER`, `MANAGER` |
| `COMPLETED` | *None* | *Rejected (400)* | Terminal state |
| `CANCELLED` | *None* | *Rejected (400)* | Terminal state |

### Invalid Transitions:
- Starting a job directly from `CREATED` without assigning a technician is rejected (`400 INVALID_STATE_TRANSITION`).
- Completing a job directly from `CREATED` or `ASSIGNED` is rejected (`400 INVALID_STATE_TRANSITION`).
- Modifying a job in `COMPLETED` or `CANCELLED` status is rejected (`400 JOB_TERMINAL_STATE`).

---

## 4. Cross-Entity Validation

A job cannot be created with random or foreign entity IDs. When creating or assigning a job, `JobService` verifies:
1. **Customer Verification**:
   - `customerRepository.findById(caller.businessId, dto.customerId)` must exist.
   - If not found or belongs to another business: `400 CUSTOMER_NOT_FOUND`.
2. **Service Offering Verification**:
   - `serviceRepository.findById(caller.businessId, dto.serviceId)` must exist.
   - If not found or belongs to another business: `400 SERVICE_NOT_FOUND`.
3. **Technician Verification**:
   - If `dto.technicianId` is provided:
     - `memberRepository.findById(dto.technicianId)` must exist.
     - Must belong to `caller.businessId`.
     - Member `status` must be `"ACTIVE"`.
     - If invalid or cross-tenant: `400 TECHNICIAN_NOT_FOUND`.

---

## 5. Permissions & RBAC Matrix

| Action | Route | OWNER | MANAGER | Assigned TECHNICIAN | Unassigned TECHNICIAN | Anonymous / Other Tenant |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **List Jobs** | `GET /api/v1/jobs` | Allowed | Allowed | Allowed | Allowed | `401` / `403` |
| **Get Job Details** | `GET /api/v1/jobs/:id` | Allowed | Allowed | Allowed | Allowed | `401` / `403` / `404` |
| **Create Job** | `POST /api/v1/jobs` | Allowed | Allowed | Denied (`403`) | Denied (`403`) | `401` / `403` |
| **Update Job Details** | `PATCH /api/v1/jobs/:id` | Allowed | Allowed | Denied (`403`) | Denied (`403`) | `401` / `403` / `404` |
| **Assign Technician** | `POST /api/v1/jobs/:id/assign` | Allowed | Allowed | Denied (`403`) | Denied (`403`) | `401` / `403` / `404` |
| **Start Job** | `POST /api/v1/jobs/:id/start` | Allowed | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |
| **Complete Job** | `POST /api/v1/jobs/:id/complete` | Allowed | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |
| **Cancel Job** | `POST /api/v1/jobs/:id/cancel` | Allowed | Allowed | Denied (`403`) | Denied (`403`) | `401` / `403` / `404` |

---

## 6. Tenant Isolation

Tenant isolation is strictly guaranteed across two layers:
1. **Server-Side Session Extraction**:
   - `businessId` is never trusted from request parameters or request bodies.
   - It is retrieved securely from the verified HTTP-only session cookie via `requireBusinessMember(req)`.
2. **Repository Composite Keying**:
   - In-memory mock: `Map<string, Job>` keyed by `${businessId}:${jobId}`.
   - Methods take `businessId` and `jobId`:
     - `findById(businessId: string, id: string): Promise<Job | null>`
     - `update(businessId: string, id: string, patch: Partial<Job>): Promise<Job | null>`
     - `findByBusinessId(businessId: string): Promise<Job[]>`
   - Attempting to access another business's job results in `404 JOB_NOT_FOUND`.

---

## 7. DynamoDB Single-Table Schema Mapping

In the AWS DynamoDB implementation (for production integration):
```
Partition Key (PK): BIZ#<businessId>
Sort Key (SK):      JOB#<jobId>
GSI1 (Status):      PK: BIZ#<businessId>, SK: STATUS#<status>#<createdAt>
GSI2 (Technician):  PK: TECH#<technicianId>, SK: JOB#<jobId>
Attributes:         customerId, serviceId, technicianId, status, title, description,
                    createdAt, updatedAt, assignedAt, startedAt, completedAt,
                    cancelledAt, cancellationReason
```

---

## 8. Parakram Automation Handoff

In `backend/src/modules/jobs/job.service.ts`, inside the `completeJob` method:
```typescript
// -------------------------------------------------------------------------
// [PARAKRAM AUTOMATION HANDOFF]
// When a job reaches COMPLETED status:
// Trigger downstream automated customer notifications (WhatsApp/SMS),
// prepare the draft quotation/invoice for review (Level 6/7),
// and schedule customer follow-up / service warranty reminder workflows.
// -------------------------------------------------------------------------
```

---

## 9. API Endpoints

### 1. List Jobs
- **Route**: `GET /api/v1/jobs`
- **Query Params**: `status`, `technicianId`, `customerId` (optional filters)
- **Response**: `200 OK` with array of jobs.

### 2. Create Job
- **Route**: `POST /api/v1/jobs`
- **Auth**: `OWNER` or `MANAGER`
- **Request Body**:
```json
{
  "customerId": "cust_3f4a9b2c1d0e4f5a",
  "serviceId": "srv_1a2b3c4d5e6f7a8b",
  "title": "AC Not Cooling - Split Unit Master Bedroom",
  "description": "Customer reports warm air blowing since yesterday.",
  "technicianId": "mem_9a8b7c6d5e4f3a2b"
}
```
- **Response**: `201 Created` with job object (`status: "ASSIGNED"` if `technicianId` provided, otherwise `"CREATED"`).

### 3. Get Job by ID
- **Route**: `GET /api/v1/jobs/:id`
- **Response**: `200 OK` with single job.

### 4. Update Job Details
- **Route**: `PATCH /api/v1/jobs/:id`
- **Auth**: `OWNER` or `MANAGER`
- **Request Body**: `{"title": "Updated title", "description": "Updated notes"}`
- **Response**: `200 OK` with updated job.

### 5. Assign Technician
- **Route**: `POST /api/v1/jobs/:id/assign`
- **Auth**: `OWNER` or `MANAGER`
- **Request Body**: `{"technicianId": "mem_9a8b7c6d5e4f3a2b"}`
- **Response**: `200 OK` with updated job (`status: "ASSIGNED"`, `assignedAt: ISO timestamp`).

### 6. Start Job
- **Route**: `POST /api/v1/jobs/:id/start`
- **Auth**: `OWNER`, `MANAGER`, or assigned `TECHNICIAN`
- **Response**: `200 OK` with updated job (`status: "IN_PROGRESS"`, `startedAt: ISO timestamp`).

### 7. Complete Job
- **Route**: `POST /api/v1/jobs/:id/complete`
- **Auth**: `OWNER`, `MANAGER`, or assigned `TECHNICIAN`
- **Response**: `200 OK` with updated job (`status: "COMPLETED"`, `completedAt: ISO timestamp`).

### 8. Cancel Job
- **Route**: `POST /api/v1/jobs/:id/cancel`
- **Auth**: `OWNER` or `MANAGER`
- **Request Body**: `{"reason": "Customer rescheduled indefinitely"}`
- **Response**: `200 OK` with updated job (`status: "CANCELLED"`, `cancelledAt: ISO timestamp`).

---

## 10. Developer Testbed

Available at `/dev/jobs`:
- Form to create new jobs selecting existing customers, services, and technicians.
- Directory listing with status filtering pills (`ALL`, `CREATED`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- Interactive action buttons matching the state machine (`Assign`, `Start Work`, `Complete Work`, `Cancel`).
- Real-time timestamped action logs.

---

## 11. Automated Tests

All 28 Level 5 tests are in [`tests/job.test.ts`](file:///home/xkrishna/startup-kaamsetu/tests/job.test.ts).

Run complete test suite:
```bash
npm test
```

### Test Coverage Highlights:
- Unauthenticated access rejection (`401`)
- Input validation (missing title, customer, service)
- Cross-entity verification (foreign customer, foreign service, foreign technician rejection)
- State transitions (`CREATED` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED`)
- Terminal state rejection (`COMPLETED` cannot start or complete again)
- Cancellation from active states and rejection once completed
- Technician RBAC: assigned technician can start and complete, unassigned technician receives `403`
- Tenant isolation: Business A cannot view, update, assign, start, complete, or cancel Business B's job.

---

## 12. Strict Boundaries

The following modules belong to later levels and are intentionally **NOT** implemented in Level 5:
- Level 6: Quotations & Estimates
- Level 7: Invoices & Billing
- Level 8: Payments & Payment Gateways
- Level 9: Business Analytics & Reporting
- Level 10: WhatsApp / SMS Customer Notifications
- Level 11: Parakram AI & Predictive Dispatching
