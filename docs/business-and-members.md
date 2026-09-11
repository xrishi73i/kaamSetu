# KaamSetu — Level 2: Business & Business Members Architecture

This document details the architectural design, implementation details, API specifications, authorization matrix, and operational workflows for **Level 2 (Business & Business Members)** of KaamSetu.

---

## 1. Purpose of Level 2

KaamSetu is the digital operating system for India's local service businesses, beginning with AC service and repair companies. While Level 1 establishes individual human identity (`AuthUser`), Level 2 establishes the multi-tenant business boundary and team structure.

### Key Principle: `USER != BUSINESS`
- A **User** is an individual person who signs up and authenticates.
- A **Business** is the legal or commercial local service enterprise (e.g. *Rishi Cooling Services*).
- A **BusinessMember** is the link table/relationship connecting a `User` to a `Business`, assigning an operational role and status.
- An **Owner** is not a separate entity; an owner is simply a `User` whose `BusinessMember` role is `OWNER`.
- A **Technician** is a `BusinessMember` whose role is `TECHNICIAN`.

---

## 2. Core Domain Models

### Business (`backend/src/modules/business/business.types.ts`)
```typescript
export interface Business {
  id: string;        // Prefix: biz_
  name: string;      // e.g. "Rishi Cooling Services"
  phone: string;     // 10-digit Indian mobile number
  address: string;   // Physical address / locality
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}
```

### BusinessMember (`backend/src/modules/members/member.types.ts`)
```typescript
export type BusinessMemberRole = "OWNER" | "MANAGER" | "TECHNICIAN";
export type BusinessMemberStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export interface BusinessMember {
  id: string;          // Prefix: mem_
  businessId: string;  // Associated Business ID
  userId: string;      // Associated AuthUser ID
  role: BusinessMemberRole;
  status: BusinessMemberStatus;
  joinedAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}
```

---

## 3. Permissions & Authorization Matrix

| Action | API Route | OWNER | MANAGER | TECHNICIAN |
|---|---|:---:|:---:|:---:|
| **Create Business** | `POST /api/v1/business` | Allowed (if no active business) | Allowed (if no active business) | Allowed (if no active business) |
| **Get Current Business** | `GET /api/v1/business` | Yes | Yes | Yes |
| **Update Business Profile** | `PATCH /api/v1/business` | Yes | No (`403 FORBIDDEN`) | No (`403 FORBIDDEN`) |
| **List Business Members** | `GET /api/v1/business/members` | Yes | Yes | Yes |
| **Invite Manager** | `POST /api/v1/business/members` | Yes | No (`403 FORBIDDEN`) | No (`403 FORBIDDEN`) |
| **Invite Technician** | `POST /api/v1/business/members` | Yes | Yes | No (`403 FORBIDDEN`) |
| **Change Member Role** | `PATCH /api/v1/business/members/[id]` | Yes | No (`403 FORBIDDEN`) | No (`403 FORBIDDEN`) |
| **Activate / Deactivate Member** | `PATCH /api/v1/business/members/[id]` | Yes | No (`403 FORBIDDEN`) | No (`403 FORBIDDEN`) |

### Guard Safeguards:
1. **Sole Owner Protection**: An `OWNER` cannot demote or deactivate the sole owner of a business (`400 CANNOT_DEMOTE_SOLE_OWNER`).
2. **Tenant Isolation**: Every member query and modification is strictly scoped to `caller.businessId`. Any attempt to modify a member belonging to another business is rejected with `404 MEMBER_NOT_FOUND`.

---

## 4. API Endpoints

### Business Endpoints

#### 1. Create Business
- **Method / Route**: `POST /api/v1/business`
- **Auth Required**: Yes (`kaamsetu_session` cookie or Bearer token)
- **Request Body**:
  ```json
  {
    "name": "Rishi Cooling Services",
    "phone": "9876543210",
    "address": "Plot 42, Okhla Phase III, New Delhi"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "business": {
        "id": "biz_e5491cf15243d9",
        "name": "Rishi Cooling Services",
        "phone": "9876543210",
        "address": "Plot 42, Okhla Phase III, New Delhi",
        "createdAt": "2026-09-11T15:00:00.000Z",
        "updatedAt": "2026-09-11T15:00:00.000Z"
      },
      "member": {
        "id": "mem_a8f9024bc10214",
        "businessId": "biz_e5491cf15243d9",
        "userId": "usr_78f1491cf15243d9",
        "role": "OWNER",
        "status": "ACTIVE",
        "joinedAt": "2026-09-11T15:00:00.000Z"
      }
    }
  }
  ```

#### 2. Get Business
- **Method / Route**: `GET /api/v1/business`
- **Auth Required**: Yes
- **Behavior**: Backend resolves the business through the caller's active `BusinessMember` record. Client-provided business IDs are not trusted.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "business": { "id": "biz_...", "name": "...", "phone": "...", "address": "..." },
      "member": { "id": "mem_...", "role": "OWNER", "status": "ACTIVE" }
    }
  }
  ```

#### 3. Update Business
- **Method / Route**: `PATCH /api/v1/business`
- **Auth Required**: Yes (`OWNER` only)
- **Request Body**:
  ```json
  {
    "name": "Rishi HVAC Solutions",
    "address": "Headquarters 2nd Floor, Delhi"
  }
  ```

---

### Members Endpoints

#### 1. List Members
- **Method / Route**: `GET /api/v1/business/members`
- **Auth Required**: Yes (Must be an active member of the business)
- **Response (200 OK)**: Returns list of members with enriched user profiles.

#### 2. Invite Member
- **Method / Route**: `POST /api/v1/business/members`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Request Body**:
  ```json
  {
    "name": "Suresh Sharma",
    "email": "suresh@example.com",
    "phone": "9811223344",
    "role": "TECHNICIAN"
  }
  ```

#### 3. Update Member
- **Method / Route**: `PATCH /api/v1/business/members/[id]`
- **Auth Required**: Yes (`OWNER` only)
- **Request Body**:
  ```json
  {
    "role": "MANAGER",
    "status": "ACTIVE"
  }
  ```

---

## 5. Automated Testing

All 15 Level 2 automated unit and integration tests are implemented in [tests/business.test.ts](file:///home/xkrishna/startup-kaamsetu/tests/business.test.ts) using Node's test runner (`node:test`) and jiti runtime loader.

To run the complete test suite:
```bash
npm test
```

### Covered Test Cases:
1. `Create business succeeds for authenticated user, assigns OWNER role`
2. `Create business rejects unauthenticated request (401)`
3. `Create business rejects invalid name or phone (400)`
4. `Create business rejects if user already owns a business (409)`
5. `Get business returns business and membership for authenticated user`
6. `Get business returns 404 when user has no business`
7. `Update business succeeds when called by OWNER`
8. `Update business rejects when called by TECHNICIAN (403)`
9. `List members returns all members of the business`
10. `Invite member succeeds when called by OWNER`
11. `Invite member succeeds when called by MANAGER (for technician)`
12. `Invite member rejects invalid role or duplicate membership`
13. `Invite member rejects when called by TECHNICIAN (403)`
14. `Change member role and status succeeds when called by OWNER`
15. `Tenant isolation: Member from Business A cannot access or modify Business B`

---

## 6. What is Intentionally Postponed to Level 3

Level 2 establishes only the service business structure and multi-tenant team members. The following capabilities belong to Level 3:
- Customer records and customer address books
- AC Service / Repair job cards and dispatching to technicians
- Work orders, parts tracking, quotations, and invoicing
- Payments and ledger transactions
