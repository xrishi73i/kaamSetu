# KaamSetu

> The digital operating system for India's local service businesses.

## Development Status

### LEVEL 1 — Authentication Foundation
- **Status:** Development / mock authentication implemented.
- **Provider:** `MockAuthProvider` (active in-memory development provider with salted SHA-256 password hashing).
- **Production:** AWS Cognito integration pending handoff with Manish.
- **Documentation:** See [`docs/authentication.md`](docs/authentication.md) for architecture, API specifications, and AWS handoff guide.

### LEVEL 2 — Business & Business Members
- **Status:** Implemented and verified.
- **Scope:** Multi-tenant service business structure (`USER != BUSINESS`), owner assignment, member invitations, role management (`OWNER`, `MANAGER`, `TECHNICIAN`), and strict tenant isolation.
- **Documentation:** See [`docs/business-and-members.md`](docs/business-and-members.md).

### LEVEL 3 — Customers
- **Status:** Implemented and verified.
- **Scope:** Customer directory scoped strictly by business tenant (`businessId + customerId`), RBAC permissions (`OWNER`/`MANAGER` write, all roles read), validation, and dev testbed.
- **Documentation:** See [`docs/customers.md`](docs/customers.md).

### LEVEL 4 — Services
- **Status:** Implemented and verified.
- **Scope:** Service catalog scoped strictly by business tenant (`businessId + serviceId`), integer minor-unit pricing (paise), RBAC permissions (`OWNER`/`MANAGER` write, all roles read), validation, and dev testbed.
- **Documentation:** See [`docs/services.md`](docs/services.md).

### LEVEL 5 — Jobs
- **Status:** Implemented and verified.
- **Scope:** Work order entity with lifecycle state transitions (`CREATED` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`), cross-entity validation (customer, service, and technician all scoped to tenant), RBAC authorization (technicians can only advance jobs assigned to them), DynamoDB-ready single-table design (`PK: BIZ#<businessId>, SK: JOB#<jobId>`), Parakram automation handoff comment on completion, and dev testbed.
- **Documentation:** See [`docs/jobs.md`](docs/jobs.md).

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
