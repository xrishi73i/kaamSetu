import crypto from "node:crypto";
import { ServiceOffering, CreateServiceDto, UpdateServiceDto } from "./service.types";

// ============================================================
// AWS HANDOFF — MANISH / DYNAMODB INTEGRATION
// Existing repository interface pattern is intentionally preserved.
// When connecting to DynamoDB single-table design:
// - Partition Key (PK): BIZ#<businessId>
// - Sort Key (SK): SRV#<serviceId>
// All queries, updates, and deletes must strictly query with both
// businessId (PK) and serviceId (SK) to enforce tenant isolation.
// Do not perform scans or unpartitioned serviceId lookups.
// ============================================================

export interface CreateServiceParams extends CreateServiceDto {
  businessId: string;
}

export interface IServiceRepository {
  create(params: CreateServiceParams): Promise<ServiceOffering>;
  findById(businessId: string, id: string): Promise<ServiceOffering | null>;
  findByBusinessId(businessId: string): Promise<ServiceOffering[]>;
  update(businessId: string, id: string, dto: UpdateServiceDto): Promise<ServiceOffering | null>;
  delete(businessId: string, id: string): Promise<boolean>;
}

export class MockServiceRepository implements IServiceRepository {
  // Key format: `${businessId}:${serviceId}` to strictly partition data by tenant in-memory
  private services = new Map<string, ServiceOffering>();

  public async create(params: CreateServiceParams): Promise<ServiceOffering> {
    const id = "srv_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();

    const service: ServiceOffering = {
      id,
      businessId: params.businessId,
      name: params.name.trim(),
      description: params.description ? params.description.trim() : undefined,
      price: params.price,
      createdAt: now,
      updatedAt: now,
    };

    const key = `${params.businessId}:${id}`;
    this.services.set(key, service);
    return { ...service };
  }

  public async findById(businessId: string, id: string): Promise<ServiceOffering | null> {
    const key = `${businessId}:${id}`;
    const service = this.services.get(key);
    return service ? { ...service } : null;
  }

  public async findByBusinessId(businessId: string): Promise<ServiceOffering[]> {
    const list: ServiceOffering[] = [];
    for (const service of this.services.values()) {
      if (service.businessId === businessId) {
        list.push({ ...service });
      }
    }
    // Return sorted newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async update(
    businessId: string,
    id: string,
    dto: UpdateServiceDto
  ): Promise<ServiceOffering | null> {
    const key = `${businessId}:${id}`;
    const existing = this.services.get(key);
    if (!existing) {
      return null;
    }

    const updated: ServiceOffering = {
      ...existing,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      description:
        dto.description !== undefined
          ? dto.description.trim().length > 0
            ? dto.description.trim()
            : undefined
          : existing.description,
      price: dto.price !== undefined ? dto.price : existing.price,
      updatedAt: new Date().toISOString(),
    };

    this.services.set(key, updated);
    return { ...updated };
  }

  public async delete(businessId: string, id: string): Promise<boolean> {
    const key = `${businessId}:${id}`;
    return this.services.delete(key);
  }

  public __resetForTesting(): void {
    this.services.clear();
  }
}

// Global repository singleton
const globalForSrv = globalThis as unknown as { serviceRepository?: MockServiceRepository };

export const serviceRepository =
  globalForSrv.serviceRepository || new MockServiceRepository();

if (process.env.NODE_ENV !== "production") {
  globalForSrv.serviceRepository = serviceRepository;
}
