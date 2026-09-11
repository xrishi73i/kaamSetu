import crypto from "node:crypto";
import { Job, CreateJobDto, JobStatus } from "./job.types";

// ============================================================
// AWS HANDOFF — MANISH / DYNAMODB INTEGRATION
// Existing repository interface pattern is intentionally preserved.
// When connecting to DynamoDB single-table design:
// - Partition Key (PK): BIZ#<businessId>
// - Sort Key (SK): JOB#<jobId>
// All queries, updates, and deletes must strictly query with both
// businessId (PK) and jobId (SK) to enforce tenant isolation.
// Do not perform scans or unpartitioned jobId lookups.
// ============================================================

export interface CreateJobParams extends CreateJobDto {
  businessId: string;
  status: JobStatus;
}

export interface IJobRepository {
  create(params: CreateJobParams): Promise<Job>;
  findById(businessId: string, id: string): Promise<Job | null>;
  findByBusinessId(businessId: string): Promise<Job[]>;
  update(businessId: string, id: string, partial: Partial<Job>): Promise<Job | null>;
  delete(businessId: string, id: string): Promise<boolean>;
}

export class MockJobRepository implements IJobRepository {
  // Key format: `${businessId}:${jobId}` to strictly partition data by tenant in-memory
  private jobs = new Map<string, Job>();

  public async create(params: CreateJobParams): Promise<Job> {
    const id = "job_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const now = new Date().toISOString();

    const job: Job = {
      id,
      businessId: params.businessId,
      customerId: params.customerId,
      serviceId: params.serviceId,
      technicianId: params.technicianId || undefined,
      title: params.title.trim(),
      description: params.description ? params.description.trim() : undefined,
      status: params.status,
      createdAt: now,
      updatedAt: now,
    };

    const key = `${params.businessId}:${id}`;
    this.jobs.set(key, job);
    return { ...job };
  }

  public async findById(businessId: string, id: string): Promise<Job | null> {
    const key = `${businessId}:${id}`;
    const job = this.jobs.get(key);
    return job ? { ...job } : null;
  }

  public async findByBusinessId(businessId: string): Promise<Job[]> {
    const list: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.businessId === businessId) {
        list.push({ ...job });
      }
    }
    // Return sorted newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async update(
    businessId: string,
    id: string,
    partial: Partial<Job>
  ): Promise<Job | null> {
    const key = `${businessId}:${id}`;
    const existing = this.jobs.get(key);
    if (!existing) {
      return null;
    }

    const updated: Job = {
      ...existing,
      ...partial,
      id: existing.id, // Never mutate ID
      businessId: existing.businessId, // Never mutate tenant ID
      customerId: existing.customerId, // Never mutate customer ID
      serviceId: existing.serviceId, // Never mutate service ID
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(key, updated);
    return { ...updated };
  }

  public async delete(businessId: string, id: string): Promise<boolean> {
    const key = `${businessId}:${id}`;
    return this.jobs.delete(key);
  }

  public __resetForTesting(): void {
    this.jobs.clear();
  }
}

// Global repository singleton
const globalForJobs = globalThis as unknown as { jobRepository?: MockJobRepository };

export const jobRepository =
  globalForJobs.jobRepository || new MockJobRepository();

if (process.env.NODE_ENV !== "production") {
  globalForJobs.jobRepository = jobRepository;
}
