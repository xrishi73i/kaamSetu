import crypto from "node:crypto";
import { BusinessMember, BusinessMemberRole, BusinessMemberStatus } from "./member.types";

export interface CreateMemberRecordParams {
  businessId: string;
  userId: string;
  role: BusinessMemberRole;
  status: BusinessMemberStatus;
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}

export interface IMemberRepository {
  create(params: CreateMemberRecordParams): Promise<BusinessMember>;
  findById(id: string): Promise<BusinessMember | null>;
  findByUserId(userId: string): Promise<BusinessMember | null>;
  findByBusinessId(businessId: string): Promise<BusinessMember[]>;
  findByBusinessAndUser(businessId: string, userId: string): Promise<BusinessMember | null>;
  update(id: string, partial: Partial<BusinessMember>): Promise<BusinessMember>;
  delete(id: string): Promise<void>;
}

export class MockMemberRepository implements IMemberRepository {
  private members = new Map<string, BusinessMember>();

  public async create(params: CreateMemberRecordParams): Promise<BusinessMember> {
    const id = "mem_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();

    const member: BusinessMember = {
      id,
      businessId: params.businessId,
      userId: params.userId,
      role: params.role,
      status: params.status,
      joinedAt: now,
      updatedAt: now,
      user: params.user,
    };

    this.members.set(id, member);
    return { ...member };
  }

  public async findById(id: string): Promise<BusinessMember | null> {
    const member = this.members.get(id);
    return member ? { ...member } : null;
  }

  public async findByUserId(userId: string): Promise<BusinessMember | null> {
    for (const member of this.members.values()) {
      if (member.userId === userId && member.status !== "INACTIVE") {
        return { ...member };
      }
    }
    // If only inactive exists, return it or null
    for (const member of this.members.values()) {
      if (member.userId === userId) {
        return { ...member };
      }
    }
    return null;
  }

  public async findByBusinessId(businessId: string): Promise<BusinessMember[]> {
    const list: BusinessMember[] = [];
    for (const member of this.members.values()) {
      if (member.businessId === businessId) {
        list.push({ ...member });
      }
    }
    return list;
  }

  public async findByBusinessAndUser(
    businessId: string,
    userId: string
  ): Promise<BusinessMember | null> {
    for (const member of this.members.values()) {
      if (member.businessId === businessId && member.userId === userId) {
        return { ...member };
      }
    }
    return null;
  }

  public async update(id: string, partial: Partial<BusinessMember>): Promise<BusinessMember> {
    const existing = this.members.get(id);
    if (!existing) {
      throw new Error(`Member with ID ${id} not found.`);
    }

    const updated: BusinessMember = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    this.members.set(id, updated);
    return { ...updated };
  }

  public async delete(id: string): Promise<void> {
    this.members.delete(id);
  }

  public __resetForTesting(): void {
    this.members.clear();
  }
}

// Global repository singleton
const globalForMem = globalThis as unknown as { memberRepository?: MockMemberRepository };

export const memberRepository =
  globalForMem.memberRepository || new MockMemberRepository();

if (process.env.NODE_ENV !== "production") {
  globalForMem.memberRepository = memberRepository;
}
