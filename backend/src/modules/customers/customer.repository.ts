import crypto from "node:crypto";
import { Customer, CreateCustomerDto, UpdateCustomerDto } from "./customer.types";
import { normalizePhone } from "./customer.validation";

// ============================================================
// AWS HANDOFF — MANISH / DYNAMODB INTEGRATION
// Existing repository interface pattern is intentionally preserved.
// When connecting to DynamoDB single-table design:
// - Partition Key (PK): BIZ#<businessId>
// - Sort Key (SK): CUST#<customerId>
// All queries, updates, and deletes must strictly query with both
// businessId (PK) and customerId (SK) to enforce tenant isolation.
// Do not perform scans or un-scoped customerId lookups.
// ============================================================

export interface CreateCustomerParams extends CreateCustomerDto {
  businessId: string;
}

export interface ICustomerRepository {
  create(params: CreateCustomerParams): Promise<Customer>;
  findById(businessId: string, id: string): Promise<Customer | null>;
  findByBusinessId(businessId: string): Promise<Customer[]>;
  update(businessId: string, id: string, dto: UpdateCustomerDto): Promise<Customer | null>;
  delete(businessId: string, id: string): Promise<boolean>;
}

export class MockCustomerRepository implements ICustomerRepository {
  // Key format: `${businessId}:${customerId}` to strictly partition data by tenant in-memory
  private customers = new Map<string, Customer>();

  public async create(params: CreateCustomerParams): Promise<Customer> {
    const id = "cust_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();

    const customer: Customer = {
      id,
      businessId: params.businessId,
      name: params.name.trim(),
      phone: normalizePhone(params.phone),
      email: params.email ? params.email.trim().toLowerCase() : undefined,
      address: params.address ? params.address.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const key = `${params.businessId}:${id}`;
    this.customers.set(key, customer);
    return { ...customer };
  }

  public async findById(businessId: string, id: string): Promise<Customer | null> {
    const key = `${businessId}:${id}`;
    const customer = this.customers.get(key);
    return customer ? { ...customer } : null;
  }

  public async findByBusinessId(businessId: string): Promise<Customer[]> {
    const list: Customer[] = [];
    for (const customer of this.customers.values()) {
      if (customer.businessId === businessId) {
        list.push({ ...customer });
      }
    }
    // Return sorted newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async update(
    businessId: string,
    id: string,
    dto: UpdateCustomerDto
  ): Promise<Customer | null> {
    const key = `${businessId}:${id}`;
    const existing = this.customers.get(key);
    if (!existing) {
      return null;
    }

    const updated: Customer = {
      ...existing,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      phone: dto.phone !== undefined ? normalizePhone(dto.phone) : existing.phone,
      email:
        dto.email !== undefined
          ? dto.email.trim().length > 0
            ? dto.email.trim().toLowerCase()
            : undefined
          : existing.email,
      address:
        dto.address !== undefined
          ? dto.address.trim().length > 0
            ? dto.address.trim()
            : undefined
          : existing.address,
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(key, updated);
    return { ...updated };
  }

  public async delete(businessId: string, id: string): Promise<boolean> {
    const key = `${businessId}:${id}`;
    return this.customers.delete(key);
  }

  public __resetForTesting(): void {
    this.customers.clear();
  }
}

// Global repository singleton
const globalForCust = globalThis as unknown as { customerRepository?: MockCustomerRepository };

export const customerRepository =
  globalForCust.customerRepository || new MockCustomerRepository();

if (process.env.NODE_ENV !== "production") {
  globalForCust.customerRepository = customerRepository;
}
