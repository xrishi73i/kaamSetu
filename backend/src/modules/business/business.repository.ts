import crypto from "node:crypto";
import { Business, CreateBusinessDto, UpdateBusinessDto } from "./business.types";
import { normalizePhone } from "./business.validation";

export interface IBusinessRepository {
  create(dto: CreateBusinessDto): Promise<Business>;
  findById(id: string): Promise<Business | null>;
  update(id: string, dto: UpdateBusinessDto): Promise<Business>;
  list(): Promise<Business[]>;
}

export class MockBusinessRepository implements IBusinessRepository {
  private businesses = new Map<string, Business>();

  public async create(dto: CreateBusinessDto): Promise<Business> {
    const id = "biz_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();

    const business: Business = {
      id,
      name: dto.name.trim(),
      phone: normalizePhone(dto.phone),
      address: dto.address.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.businesses.set(id, business);
    return { ...business };
  }

  public async findById(id: string): Promise<Business | null> {
    const business = this.businesses.get(id);
    return business ? { ...business } : null;
  }

  public async update(id: string, dto: UpdateBusinessDto): Promise<Business> {
    const existing = this.businesses.get(id);
    if (!existing) {
      throw new Error(`Business with ID ${id} not found.`);
    }

    const updated: Business = {
      ...existing,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      phone: dto.phone !== undefined ? normalizePhone(dto.phone) : existing.phone,
      address: dto.address !== undefined ? dto.address.trim() : existing.address,
      updatedAt: new Date().toISOString(),
    };

    this.businesses.set(id, updated);
    return { ...updated };
  }

  public async list(): Promise<Business[]> {
    return Array.from(this.businesses.values()).map((b) => ({ ...b }));
  }

  public __resetForTesting(): void {
    this.businesses.clear();
  }
}

// Global repository singleton
const globalForBiz = globalThis as unknown as { businessRepository?: MockBusinessRepository };

export const businessRepository =
  globalForBiz.businessRepository || new MockBusinessRepository();

if (process.env.NODE_ENV !== "production") {
  globalForBiz.businessRepository = businessRepository;
}
