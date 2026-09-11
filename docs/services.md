# KaamSetu — Level 4: Services Architecture

This document details the architectural design, API specifications, authorization matrix, tenant isolation rules, money representation, database mapping, and testing strategy for **Level 4 (Services)** of KaamSetu.

---

## 1. Purpose of Level 4

In KaamSetu's core lifecycle for local service businesses (e.g. AC service and repair):
```
Customer → Job → Technician → Work → Quotation → Invoice → Payment → History → Repeat Service
```

- Level 1 established human identity (`AuthUser`).
- Level 2 established multi-tenant service business structure (`Business` and `BusinessMember`).
- Level 3 established client directory (`Customer`).
- Level 4 establishes **Services** — the catalog of service offerings that a business performs for customers (e.g., *AC Installation*, *AC Deep Jet Cleaning*, *AC Gas Refill*, *AC PCB Repair*).

### Multi-Tenant Hierarchy
```
Business (biz_...) [Tenant Partition]
 ├── Members (mem_...) [Staff & Technicians]
 ├── Customers (cust_...) [Clients & Service Locations]
 └── Services (srv_...) [Catalog of Service Offerings]
```

Every service offering belongs to **exactly one Business**. Cross-tenant access is strictly forbidden.

---

## 2. Naming Clarification

To avoid confusion in the codebase:
- **`ServiceOffering` (or `Service`)**: The KaamSetu domain entity representing an offering (e.g. "AC Deep Cleaning", price: 50000 paise).
- **`ServiceCatalogService`**: The business logic application service layer handling validation, RBAC, and repository coordination.

---

## 3. Money Representation: Integer Minor Units (Paise)

To prevent rounding and floating-point errors (e.g., `0.1 + 0.2 = 0.30000000000000004`):
- All prices are strictly stored as **non-negative integers in minor currency units (paise)**.
- **₹1.00 = 100 paise**.
- Example: **₹500.00** is represented as **`50000` paise**.
- Floating-point numbers (e.g., `499.50`) are rejected during input validation with code `400 VALIDATION_ERROR`.
- The user interface provides transparent conversion, allowing operators to enter amounts in Rupees while sending integer paise to the backend.

---

## 4. Service Domain Model

### Data Model (`backend/src/modules/services/service.types.ts`)
```typescript
export interface ServiceOffering {
  id: string;          // Prefix: srv_
  businessId: string;  // Multi-tenant business partition
  name: string;        // Name of service (e.g. "AC Deep Jet Cleaning")
  description?: string;// Optional description
  price: number;       // Integer in minor units (paise)
  createdAt: string;   // ISO 8601 timestamp
  updatedAt: string;   // ISO 8601 timestamp
}

export type Service = ServiceOffering;
```

### Data Transfer Objects (DTOs)
```typescript
export interface CreateServiceDto {
  name: string;
  description?: string;
  price: number; // In minor units (paise)
}

export interface UpdateServiceDto {
  name?: string;
  description?: string;
  price?: number; // In minor units (paise)
  businessId?: never; // Protected field
  id?: never;         // Protected field
}
```

---

## 5. Permissions & RBAC Matrix

| Action | Route | OWNER | MANAGER | TECHNICIAN | Other Business / Anonymous |
|---|---|:---:|:---:|:---:|:---:|
| **List Services** | `GET /api/v1/services` | Allowed | Allowed | Allowed | `401` / `403` |
| **Get Service Details** | `GET /api/v1/services/:id` | Allowed | Allowed | Allowed | `401` / `403` / `404` |
| **Create Service** | `POST /api/v1/services` | Allowed | Allowed | Denied (`403`) | `401` / `403` |
| **Update Service** | `PATCH /api/v1/services/:id` | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |
| **Delete Service** | `DELETE /api/v1/services/:id` | Allowed | Allowed | Denied (`403`) | `401` / `403` / `404` |

### Rationale:
- **Technicians** need read access to services and their base prices when on field jobs to know the standard service catalog.
- **Catalog Configuration** (creating services, changing prices, removing services) is restricted to `OWNER` and `MANAGER` roles to prevent unauthorized price alterations.

---

## 6. Tenant Isolation

Tenant isolation is enforced across both layers:
1. **Route & Service Layer**:
   - `businessId` is **never** accepted from the client request payload.
   - It is derived from the server-side session using `requireBusinessMember(req)`.
   - Any client attempt to pass `businessId` in `PATCH` is rejected with `400 VALIDATION_ERROR`.
2. **Repository Layer**:
   - Every read, update, and delete requires both `businessId` and `serviceId`:
     - `findById(businessId: string, id: string): Promise<ServiceOffering | null>`
     - `update(businessId: string, id: string, dto: UpdateServiceDto): Promise<ServiceOffering | null>`
     - `delete(businessId: string, id: string): Promise<boolean>`
     - `findByBusinessId(businessId: string): Promise<ServiceOffering[]>`
   - If Business A attempts to read or mutate a service from Business B, the repository returns `null` and the API responds with `404 SERVICE_NOT_FOUND`.

---

## 7. API Endpoints

### 1. List Services
- **Method / Route**: `GET /api/v1/services`
- **Auth Required**: Yes (`OWNER`, `MANAGER`, `TECHNICIAN`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "srv_3f4a9b2c1d0e4f5a",
      "businessId": "biz_e5491cf15243d9",
      "name": "AC Deep Jet Cleaning",
      "description": "Full foam jet wash for indoor & outdoor units",
      "price": 50000,
      "createdAt": "2026-09-11T17:00:00.000Z",
      "updatedAt": "2026-09-11T17:00:00.000Z"
    }
  ]
}
```

### 2. Create Service
- **Method / Route**: `POST /api/v1/services`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Request Body**:
```json
{
  "name": "AC Deep Jet Cleaning",
  "description": "Full foam jet wash for indoor & outdoor units",
  "price": 50000
}
```
- **Response (201 Created)**: Returns created service object.

### 3. Get Service by ID
- **Method / Route**: `GET /api/v1/services/:id`
- **Auth Required**: Yes (`OWNER`, `MANAGER`, `TECHNICIAN`)
- **Response (200 OK)**: Single service offering object.
- **Error**: `404 SERVICE_NOT_FOUND` if not found or cross-tenant.

### 4. Update Service
- **Method / Route**: `PATCH /api/v1/services/:id`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Request Body** (partial update):
```json
{
  "price": 60000
}
```
- **Response (200 OK)**: Updated service offering object.

### 5. Delete Service
- **Method / Route**: `DELETE /api/v1/services/:id`
- **Auth Required**: Yes (`OWNER` or `MANAGER`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "srv_3f4a9b2c1d0e4f5a",
    "deleted": true
  }
}
```

---

## 8. DynamoDB Single-Table Schema Mapping

In the future AWS DynamoDB implementation by Manish:
```
Partition Key (PK): BIZ#<businessId>
Sort Key (SK):      SRV#<serviceId>
Attributes:         name, description, price, createdAt, updatedAt
```
Because `IServiceRepository` already requires `businessId` and `serviceId` on all operations, switching to the live DynamoDB DocumentClient requires no refactoring of route handlers or service logic.

---

## 9. Developer & Test Interface

Available at `/dev/services`:
- Create new service offerings with automatic rupee-to-paise conversion.
- View real-time catalog directory with INR formatting and minor unit breakdown.
- Edit service name, price, and description.
- Delete service offerings.
- Live timestamped activity console logger.

---

## 10. Automated Tests

All 16 Level 4 tests are in [`tests/service.test.ts`](file:///home/xkrishna/startup-kaamsetu/tests/service.test.ts).

Run complete test suite:
```bash
npm test
```

### Covered Test Cases:
1. `Authenticated user can create a service`
2. `Unauthenticated user cannot create a service (401)`
3. `Invalid service data is rejected (400)`
4. `Negative price is rejected (400)`
5. `Floating-point price is rejected (400, must be integer minor units / paise)`
6. `Authenticated business can list its services`
7. `Business A cannot see Business B's services (Tenant Isolation)`
8. `Authenticated business can retrieve its service by ID`
9. `Nonexistent service returns the correct error (404)`
10. `Business A cannot retrieve Business B's service by ID (404)`
11. `Authorized user can update its service`
12. `Unauthorized user (TECHNICIAN) cannot update a service (403)`
13. `Protected businessId cannot be changed by the client (400)`
14. `Authorized user can delete its service`
15. `Business A cannot delete Business B's service (404)`
16. `Unauthorized user (TECHNICIAN) cannot delete a service (403)`

---

## 11. Known Limitations & Strict Boundaries

The following capabilities belong to later levels and are intentionally **NOT** implemented in Level 4:
- AC Service / Repair Jobs and Work Orders
- Technician Dispatching and Assignment
- Quotations, Estimates, and Invoices
- Payments and Payment Gateways
- Discounts, Taxes, and Seasonal Promotional Pricing
