# KaamSetu — Level 3: Customers Architecture

This document details the architectural design, API specifications, authorization matrix, tenant isolation rules, database design, and testing strategy for **Level 3 (Customers)** of KaamSetu.

---

## 1. Purpose of Level 3

In KaamSetu's lifecycle for local service businesses (e.g. AC service and repair):
```
Customer → Job → Technician → Work → Quotation → Invoice → Payment → History → Repeat Service
```

Level 1 established human authentication (`AuthUser`).
Level 2 established multi-tenant service business structure (`Business` and `BusinessMember`).
Level 3 establishes **Customers** — the clients, homeowners, and commercial facilities receiving services.

### Key Architectural Hierarchy
```
Business (biz_...) [Tenant Partition]
 ├── Members (mem_...) [Staff & Technicians]
 └── Customers (cust_...) [Clients & Service Locations]
```

A customer belongs to **exactly one Business**. Every single customer query and mutation strictly enforces tenant isolation.

---

## 2. Customer Domain Model

### Data Model (`backend/src/modules/customers/customer.types.ts`)
```typescript
export interface Customer {
  id: string;          // Prefix: cust_
  businessId: string;  // Multi-tenant business partition
  name: string;        // Full name
  phone: string;       // Normalized 10-digit Indian phone number
  email?: string;      // Optional email
  address?: string;    // Service location address
  createdAt: string;   // ISO 8601 timestamp
  updatedAt: string;   // ISO 8601 timestamp
}
```

### Data Transfer Objects (DTOs)
```typescript
export interface CreateCustomerDto {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}
```

---

## 3. Permissions & RBAC Matrix

| Action | Route | OWNER | MANAGER | TECHNICIAN | Other Business / Anonymous |
|---|---|:---:|:---:|:---:|:---:|
| **List Customers** | `GET /api/v1/customers` | Allowed | Allowed | Allowed | `401` / `403` |
| **Get Customer Details** | `GET /api/v1/customers/:id` | Allowed | Allowed | Allowed | `401` / `403` / `404` |
| **Create Customer** | `POST /api/v1/customers` | Allowed | Allowed | Denied (`403`) | `401` / `403` |
| **Update Customer** | `PATCH /api/v1/customers/:id` | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |
| **Delete Customer** | `DELETE /api/v1/customers/:id` | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |

### Rationale:
- **Technicians** need read access to customers to view service addresses and contact phone numbers when assigned to service jobs.
- **Record Mutation** (create, edit, delete) is restricted to administrative and operational managers (`OWNER` and `MANAGER`) to prevent unauthorized modifications to client records.

---

## 4. Tenant Isolation

Tenant isolation is strictly enforced at two independent architectural boundaries:

1. **Service / Guard Layer (`backend/src/modules/members/member.guard.ts`)**:
   - `businessId` is **never** accepted from the client payload or query parameters.
   - The caller's business identity is resolved from the cryptographically verified session through `requireBusinessMember(req)`.
2. **Repository Layer (`backend/src/modules/customers/customer.repository.ts`)**:
   - All lookups, updates, and deletes require **both** `businessId` and `customerId`:
     - `findById(businessId: string, id: string): Promise<Customer | null>`
     - `update(businessId: string, id: string, dto: UpdateCustomerDto): Promise<Customer | null>`
     - `delete(businessId: string, id: string): Promise<boolean>`
     - `findByBusinessId(businessId: string): Promise<Customer[]>`
   - Unsafe single-key lookups by `customerId` alone do not exist in the repository interface.
   - Attempting to access or mutate a customer belonging to another business produces `404 CUSTOMER_NOT_FOUND`, preventing cross-tenant existence enumeration.

---

## 5. API Endpoints

### 1. List Customers
- **Method / Route**: `GET /api/v1/customers`
- **Auth Required**: Yes (`kaamsetu_session` cookie or Bearer token)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cust_8f9024bc10214a1e",
      "businessId": "biz_e5491cf15243d9",
      "name": "Sunil Verma",
      "phone": "9876543210",
      "email": "sunil.verma@example.com",
      "address": "B-42 Defence Colony, New Delhi",
      "createdAt": "2026-09-11T16:00:00.000Z",
      "updatedAt": "2026-09-11T16:00:00.000Z"
    }
  ]
}
```

### 2. Create Customer
- **Method / Route**: `POST /api/v1/customers`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Request Body**:
```json
{
  "name": "Sunil Verma",
  "phone": "9876543210",
  "email": "sunil.verma@example.com",
  "address": "B-42 Defence Colony, New Delhi"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "cust_8f9024bc10214a1e",
    "businessId": "biz_e5491cf15243d9",
    "name": "Sunil Verma",
    "phone": "9876543210",
    "email": "sunil.verma@example.com",
    "address": "B-42 Defence Colony, New Delhi",
    "createdAt": "2026-09-11T16:00:00.000Z",
    "updatedAt": "2026-09-11T16:00:00.000Z"
  }
}
```

### 3. Get Customer by ID
- **Method / Route**: `GET /api/v1/customers/:id`
- **Auth Required**: Yes (All active business members)
- **Response (200 OK)**: Single customer object.
- **Error**: `404 CUSTOMER_NOT_FOUND` if the customer does not exist or belongs to a different business.

### 4. Update Customer
- **Method / Route**: `PATCH /api/v1/customers/:id`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Request Body** (partial update):
```json
{
  "phone": "9812345678",
  "address": "Sector 62, Block C, Noida"
}
```
- **Response (200 OK)**: Updated customer object.

### 5. Delete Customer
- **Method / Route**: `DELETE /api/v1/customers/:id`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "cust_8f9024bc10214a1e",
    "deleted": true
  }
}
```

---

## 6. Service & Repository Layer

The customer subsystem follows the existing multi-layer architecture:
```
Next.js App Router (app/api/v1/customers/)
  ↓
Authentication & Authorization Guard (requireBusinessMember)
  ↓
Validation Layer (validateCreateCustomer / validateUpdateCustomer)
  ↓
Customer Service (CustomerService)
  ↓
Customer Repository (ICustomerRepository / MockCustomerRepository)
  ↓
In-Memory Storage (with DynamoDB single-table schema mapping)
```

### DynamoDB Schema Mapping & AWS Handoff
```
Partition Key (PK): BIZ#<businessId>
Sort Key (SK):      CUST#<customerId>
Attributes:         name, phone, email, address, createdAt, updatedAt
```
When transitioning from the in-memory repository to DynamoDB:
- Lookups use `GetItem` with `{ PK: "BIZ#" + businessId, SK: "CUST#" + customerId }`.
- Listing uses `Query` with `PK = "BIZ#" + businessId` and `begins_with(SK, "CUST#")`.
- Deletions and updates strictly specify both `PK` and `SK`.

---

## 7. Developer & Test Interface

A testing interface is available at `/dev/customers` allowing manual verification:
- Creating customers with field validation.
- Browsing all registered customers for the current active business tenant.
- Selecting, viewing, editing, and deleting individual customer records.
- Live console activity logger showing timestamped network and mutation payloads.

---

## 8. Automated Testing

All 14 Level 3 test cases are located in [`tests/customer.test.ts`](file:///home/xkrishna/startup-kaamsetu/tests/customer.test.ts).

Run complete test suite:
```bash
npm test
```

### Covered Test Cases:
1. `Authenticated user can create a customer`
2. `Unauthenticated user cannot create a customer (401)`
3. `Invalid customer data is rejected (400)`
4. `Authenticated business can list its customers`
5. `Business A cannot see Business B's customers (Tenant Isolation)`
6. `Authenticated business can get one of its customers by ID`
7. `Nonexistent customer returns 404`
8. `Business A cannot access Business B's customer by ID (404)`
9. `Authorized user can update an owned customer`
10. `Unauthorized user (TECHNICIAN) cannot update a customer (403)`
11. `Authorized user can delete an owned customer`
12. `Business A cannot delete Business B's customer (404)`
13. `Unauthorized user (TECHNICIAN) cannot delete a customer (403)`
14. `Patch rejects empty or invalid update data (400)`

---

## 9. Known Limitations & Strict Boundaries

The following modules and features belong to later levels and are intentionally **NOT** implemented in Level 3:
- Services Catalog and Pricing
- AC Service / Repair Jobs and Technician Dispatching
- Quotations, Work Orders, and Estimates
- Invoices and Payment Collection
- Customer Communication (SMS/WhatsApp notifications)
