"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { jobClient } from "@/lib/api/job-client";
import { customerClient } from "@/lib/api/customer-client";
import { serviceClient } from "@/lib/api/service-client";
import { businessClient } from "@/lib/api/business-client";
import { Job, JobStatus } from "@/backend/src/modules/jobs/job.types";
import { Customer } from "@/backend/src/modules/customers/customer.types";
import { ServiceOffering } from "@/backend/src/modules/services/service.types";
import { Business } from "@/backend/src/modules/business/business.types";
import { BusinessMember } from "@/backend/src/modules/members/member.types";
import { useAuth } from "@/lib/auth/auth-context";

export default function DevJobsPage() {
  const { user } = useAuth();

  // Tenant context
  const [businessData, setBusinessData] = useState<{
    business: Business;
    member: BusinessMember;
  } | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(false);

  // Referenced lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [members, setMembers] = useState<BusinessMember[]>([]);

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  // Create Job form
  const [createForm, setCreateForm] = useState({
    customerId: "",
    serviceId: "",
    title: "Split AC Deep Cleaning & Gas Inspection",
    description: "Indoor unit jet chemical wash, outdoor fan lube, gas pressure gauge check",
    technicianId: "",
  });

  // Selected Job for edit or lifecycle action
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
  });
  const [selectedTechToAssign, setSelectedTechToAssign] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Console output
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    businessClient.getBusiness().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        addLog(`Failed to load business: ${error.message}`);
      } else if (data) {
        setBusinessData(data);
        addLog(`Loaded business "${data.business.name}" (Role: ${data.member.role})`);

        // Load referenced customers, services, members, and jobs in parallel
        Promise.all([
          customerClient.listCustomers(),
          serviceClient.listServices(),
          businessClient.listMembers(),
          jobClient.listJobs(),
        ]).then(([custRes, srvRes, memRes, jobRes]) => {
          if (!isMounted) return;
          if (custRes.data) {
            setCustomers(custRes.data);
            if (custRes.data.length > 0) {
              const defaultCustId = custRes.data[0].id;
              setCreateForm((prev) => (prev.customerId ? prev : { ...prev, customerId: defaultCustId }));
            }
          }
          if (srvRes.data) {
            setServices(srvRes.data);
            if (srvRes.data.length > 0) {
              const defaultSrvId = srvRes.data[0].id;
              setCreateForm((prev) => (prev.serviceId ? prev : { ...prev, serviceId: defaultSrvId }));
            }
          }
          if (memRes.data) {
            setMembers(memRes.data);
          }
          if (jobRes.data) {
            setJobs(jobRes.data);
            addLog(`Loaded ${jobRes.data.length} jobs.`);
          }
        });
      }
      setIsLoadingBusiness(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Refresh jobs list
  const loadJobs = () => {
    setIsLoadingJobs(true);
    jobClient.listJobs().then(({ data, error }) => {
      setIsLoadingJobs(false);
      if (error) {
        addLog(`List jobs error [${error.code}]: ${error.message}`);
      } else if (data) {
        setJobs(data);
        addLog(`Retrieved ${data.length} jobs.`);
      }
    });
  };

  // Create Job Handler
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.customerId || !createForm.serviceId) {
      addLog("Error: Please select both a customer and a service.");
      return;
    }

    setIsLoadingAction("create");
    addLog(`Creating job: "${createForm.title}"...`);

    const { data, error } = await jobClient.createJob({
      customerId: createForm.customerId,
      serviceId: createForm.serviceId,
      title: createForm.title,
      description: createForm.description || undefined,
      technicianId: createForm.technicianId || undefined,
    });

    setIsLoadingAction(null);

    if (error) {
      addLog(`Create Job Error [${error.code}]: ${error.message}`);
      if (error.details) {
        Object.entries(error.details).forEach(([f, msgs]) => {
          addLog(` -> ${f}: ${msgs.join(", ")}`);
        });
      }
    } else if (data) {
      addLog(`Job created: ${data.title} (${data.id}) [Status: ${data.status}]`);
      loadJobs();
    }
  };

  // Assign Technician Handler
  const handleAssign = async (jobId: string) => {
    if (!selectedTechToAssign) {
      addLog("Error: Please select a technician to assign.");
      return;
    }

    setIsLoadingAction(`assign-${jobId}`);
    addLog(`Assigning technician to job ${jobId}...`);

    const { data, error } = await jobClient.assignJob(jobId, selectedTechToAssign);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Assign Error [${error.code}]: ${error.message}`);
    } else if (data) {
      addLog(`Job ${data.id} assigned! Status is now ${data.status}.`);
      setSelectedTechToAssign("");
      loadJobs();
    }
  };

  // Start Job Handler
  const handleStartJob = async (jobId: string) => {
    setIsLoadingAction(`start-${jobId}`);
    addLog(`Starting job ${jobId}...`);

    const { data, error } = await jobClient.startJob(jobId);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Start Job Error [${error.code}]: ${error.message}`);
    } else if (data) {
      addLog(`Job ${data.id} started! Status is now IN_PROGRESS.`);
      loadJobs();
    }
  };

  // Complete Job Handler
  const handleCompleteJob = async (jobId: string) => {
    setIsLoadingAction(`complete-${jobId}`);
    addLog(`Completing job ${jobId}...`);

    const { data, error } = await jobClient.completeJob(jobId);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Complete Job Error [${error.code}]: ${error.message}`);
    } else if (data) {
      addLog(`Job ${data.id} completed! Status is now COMPLETED.`);
      loadJobs();
    }
  };

  // Cancel Job Handler
  const handleCancelJob = async (jobId: string) => {
    setIsLoadingAction(`cancel-${jobId}`);
    addLog(`Cancelling job ${jobId}...`);

    const { data, error } = await jobClient.cancelJob(jobId, cancelReason || undefined);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Cancel Job Error [${error.code}]: ${error.message}`);
    } else if (data) {
      addLog(`Job ${data.id} cancelled. Status is now CANCELLED.`);
      setCancelReason("");
      loadJobs();
    }
  };

  // Update Job Details
  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setIsLoadingAction("update");
    addLog(`Updating job ${selectedJob.id}...`);

    const { data, error } = await jobClient.updateJob(selectedJob.id, {
      title: editForm.title || undefined,
      description: editForm.description || undefined,
    });

    setIsLoadingAction(null);

    if (error) {
      addLog(`Update Error [${error.code}]: ${error.message}`);
    } else if (data) {
      addLog(`Job ${data.id} details updated.`);
      setSelectedJob(data);
      loadJobs();
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case "CREATED":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      case "ASSIGNED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "IN_PROGRESS":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
      case "CANCELLED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">KaamSetu Jobs Testbed</h1>
              <span className="rounded bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                Level 5 Module
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Work order management, state transitions, technician assignment, and tenant isolation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline">
              &larr; Dashboard
            </Link>
            <Link href="/dev/services" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline">
              Dev Services
            </Link>
            <Link href="/dev/customers" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline">
              Dev Customers
            </Link>
            <Link href="/dev/business" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline">
              Dev Business
            </Link>
            <Link href="/dev/auth" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline">
              Dev Auth
            </Link>
          </div>
        </header>

        {/* Tenant Context */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 text-xs">
          <h2 className="font-semibold text-sm mb-2">Current Tenant Context</h2>
          {isLoadingBusiness ? (
            <p className="text-zinc-400">Loading business context...</p>
          ) : businessData ? (
            <div className="flex flex-wrap gap-6 text-zinc-600 dark:text-zinc-300">
              <div>
                <span className="text-zinc-400">Business:</span>{" "}
                <strong className="text-zinc-900 dark:text-zinc-100">{businessData.business.name}</strong>{" "}
                <span className="font-mono text-zinc-400">({businessData.business.id})</span>
              </div>
              <div>
                <span className="text-zinc-400">Caller:</span> {user?.name} ({user?.email})
              </div>
              <div>
                <span className="text-zinc-400">Role:</span>{" "}
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {businessData.member.role}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Directory:</span> {customers.length} Customers · {services.length} Services · {members.length} Members
              </div>
            </div>
          ) : (
            <div className="text-amber-600 dark:text-amber-400">
              You do not belong to an active business. Please visit <Link href="/dev/business" className="underline font-bold">Dev Business</Link> first.
            </div>
          )}
        </section>

        {/* Main Grid: Create Job Form & Jobs List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Job Form */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold mb-3">Create New Job</h2>
              <form onSubmit={handleCreateJob} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Select Customer *
                  </label>
                  <select
                    required
                    value={createForm.customerId}
                    onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      No customers found. Create a customer in <Link href="/dev/customers" className="underline">Dev Customers</Link> first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Select Service Offering *
                  </label>
                  <select
                    required
                    value={createForm.serviceId}
                    onChange={(e) => setCreateForm({ ...createForm, serviceId: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">-- Choose Service --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (₹{(s.price / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {services.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      No services found. Add a service in <Link href="/dev/services" className="underline">Dev Services</Link> first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Split AC Installation"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Initial Technician Assignment (Optional)
                  </label>
                  <select
                    value={createForm.technicianId}
                    onChange={(e) => setCreateForm({ ...createForm, technicianId: e.target.value })}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">-- None (Status will be CREATED) --</option>
                    {members
                      .filter((m) => m.status === "ACTIVE")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.user?.name || m.id} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Description / Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="e.g. Customer reported cooling issues and high vibration in outdoor unit."
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingAction === "create" || !businessData || customers.length === 0 || services.length === 0}
                  className="w-full rounded-md bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isLoadingAction === "create" ? "Creating..." : "Create Job Order"}
                </button>
              </form>
            </section>

            {/* Edit Selected Job */}
            {selectedJob && (
              <section className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 dark:border-teal-900/50 dark:bg-teal-950/20">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                    Edit Job: {selectedJob.id}
                  </h2>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
                <form onSubmit={handleUpdateJob} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingAction === "update"}
                    className="w-full rounded-md bg-teal-700 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 dark:bg-teal-600"
                  >
                    {isLoadingAction === "update" ? "Updating..." : "Save Changes"}
                  </button>
                </form>
              </section>
            )}
          </div>

          {/* Jobs Directory List */}
          <div className="lg:col-span-7 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Jobs Directory</h2>
                  <p className="text-xs text-zinc-500">
                    {jobs.length} work order(s) registered under this business
                  </p>
                </div>
                <button
                  onClick={loadJobs}
                  disabled={isLoadingJobs}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isLoadingJobs ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                  No jobs found. Create your first job order using the form on the left.
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.map((j) => {
                    const cust = customers.find((c) => c.id === j.customerId);
                    const srv = services.find((s) => s.id === j.serviceId);
                    const tech = members.find((m) => m.id === j.technicianId);

                    return (
                      <div
                        key={j.id}
                        className={`rounded-lg border p-4 transition-colors space-y-3 ${
                          selectedJob?.id === j.id
                            ? "border-teal-500 bg-teal-50/20 dark:border-teal-500 dark:bg-teal-950/10"
                            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{j.title}</span>
                              <span className="font-mono text-[10px] text-zinc-400">{j.id}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                              <span>
                                <strong>Customer:</strong> {cust?.name || j.customerId}
                              </span>
                              <span>
                                <strong>Service:</strong> {srv?.name || j.serviceId}
                              </span>
                              <span>
                                <strong>Technician:</strong>{" "}
                                {tech?.user?.name ? (
                                  <span className="text-teal-700 dark:text-teal-400 font-medium">
                                    {tech.user.name} ({tech.role})
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 italic">Unassigned</span>
                                )}
                              </span>
                            </div>
                            {j.description && (
                              <p className="mt-1 text-xs text-zinc-500">{j.description}</p>
                            )}
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0 ${getStatusBadge(
                              j.status
                            )}`}
                          >
                            {j.status}
                          </span>
                        </div>

                        {/* Timestamps */}
                        <div className="flex flex-wrap gap-4 text-[11px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                          <span>Created: {new Date(j.createdAt).toLocaleTimeString()}</span>
                          {j.startedAt && <span>Started: {new Date(j.startedAt).toLocaleTimeString()}</span>}
                          {j.completedAt && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Completed: {new Date(j.completedAt).toLocaleTimeString()}
                            </span>
                          )}
                          {j.cancelledAt && (
                            <span className="text-rose-600 dark:text-rose-400">
                              Cancelled: {new Date(j.cancelledAt).toLocaleTimeString()}
                              {j.cancellationReason && ` (${j.cancellationReason})`}
                            </span>
                          )}
                        </div>

                        {/* Lifecycle Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                          {/* Assignment dropdown for CREATED or ASSIGNED */}
                          {(j.status === "CREATED" || j.status === "ASSIGNED") && (
                            <div className="flex items-center gap-1">
                              <select
                                value={selectedTechToAssign}
                                onChange={(e) => setSelectedTechToAssign(e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                              >
                                <option value="">-- Assign Tech --</option>
                                {members
                                  .filter((m) => m.status === "ACTIVE")
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.user?.name || m.id}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => handleAssign(j.id)}
                                disabled={isLoadingAction === `assign-${j.id}`}
                                className="rounded bg-blue-600 px-2.5 py-1 text-white hover:bg-blue-700 font-medium"
                              >
                                {j.status === "ASSIGNED" ? "Reassign" : "Assign"}
                              </button>
                            </div>
                          )}

                          {/* Start button for ASSIGNED */}
                          {j.status === "ASSIGNED" && (
                            <button
                              onClick={() => handleStartJob(j.id)}
                              disabled={isLoadingAction === `start-${j.id}`}
                              className="rounded bg-indigo-600 px-2.5 py-1 text-white hover:bg-indigo-700 font-medium"
                            >
                              Start Job &rarr;
                            </button>
                          )}

                          {/* Complete button for IN_PROGRESS */}
                          {j.status === "IN_PROGRESS" && (
                            <button
                              onClick={() => handleCompleteJob(j.id)}
                              disabled={isLoadingAction === `complete-${j.id}`}
                              className="rounded bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700 font-medium"
                            >
                              Complete Job ✓
                            </button>
                          )}

                          {/* Cancel button if not terminal */}
                          {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                            <div className="flex items-center gap-1 ml-auto">
                              <input
                                type="text"
                                placeholder="Reason (optional)"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 max-w-[140px]"
                              />
                              <button
                                onClick={() => handleCancelJob(j.id)}
                                disabled={isLoadingAction === `cancel-${j.id}`}
                                className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Edit Details */}
                          {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                            <button
                              onClick={() => {
                                setSelectedJob(j);
                                setEditForm({
                                  title: j.title,
                                  description: j.description || "",
                                });
                              }}
                              className="rounded px-2 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 underline ml-2"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Live Activity Console */}
        <section className="rounded-xl border border-zinc-200 bg-zinc-900 text-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Live Activity Log
            </h2>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Clear Log
            </button>
          </div>
          <div className="font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-zinc-500">Ready for job actions.</p>
            ) : (
              logs.map((log, idx) => <p key={idx}>{log}</p>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
