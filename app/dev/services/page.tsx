"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { serviceClient } from "@/lib/api/service-client";
import { businessClient } from "@/lib/api/business-client";
import { ServiceOffering } from "@/backend/src/modules/services/service.types";
import { Business } from "@/backend/src/modules/business/business.types";
import { BusinessMember } from "@/backend/src/modules/members/member.types";
import { useAuth } from "@/lib/auth/auth-context";

export default function DevServicesPage() {
  const { user } = useAuth();

  // Business context
  const [businessData, setBusinessData] = useState<{
    business: Business;
    member: BusinessMember;
  } | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(false);

  // Services list state
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // Create Service state
  // Price entered in rupees as user-facing number, converted to paise integer on submit
  const [createForm, setCreateForm] = useState({
    name: "AC Deep Jet Cleaning",
    description: "Full indoor and outdoor unit foam and pressurized water jet cleaning",
    rupees: "500",
  });

  // Selected / Edit Service state
  const [selectedService, setSelectedService] = useState<ServiceOffering | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    rupees: "",
  });

  // Console output
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // Helper to format paise into Indian Rupees
  const formatRupees = (paise: number) => {
    const rupees = paise / 100;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(rupees);
  };

  // Fetch business & membership and initial services list
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    businessClient.getBusiness().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        addLog(`Failed to fetch business context: ${error.message}`);
      } else if (data) {
        setBusinessData(data);
        addLog(`Loaded business "${data.business.name}" (Role: ${data.member.role})`);
        serviceClient.listServices().then(({ data: sList, error: sErr }) => {
          if (!isMounted) return;
          if (sErr) {
            addLog(`List services failed: [${sErr.code}] ${sErr.message}`);
          } else if (sList) {
            setServices(sList);
            addLog(`Retrieved ${sList.length} service offerings.`);
          }
        });
      }
      setIsLoadingBusiness(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Load services on manual refresh or after mutations
  const loadServices = () => {
    setIsLoadingServices(true);
    serviceClient.listServices().then(({ data, error }) => {
      setIsLoadingServices(false);
      if (error) {
        addLog(`List services failed: [${error.code}] ${error.message}`);
      } else if (data) {
        setServices(data);
        addLog(`Retrieved ${data.length} service offerings.`);
      }
    });
  };

  // Create service handler
  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction("create");

    // Convert rupees to integer paise
    const rupeeVal = parseFloat(createForm.rupees);
    if (isNaN(rupeeVal) || rupeeVal < 0) {
      addLog("Error: Please provide a valid positive price in rupees.");
      setIsLoadingAction(null);
      return;
    }

    const paise = Math.round(rupeeVal * 100);
    addLog(`Creating service: "${createForm.name}" with price ${paise} paise (₹${rupeeVal})...`);

    const { data, error } = await serviceClient.createService({
      name: createForm.name,
      description: createForm.description || undefined,
      price: paise,
    });

    setIsLoadingAction(null);

    if (error) {
      addLog(`Error [${error.code}]: ${error.message}`);
      if (error.details) {
        Object.entries(error.details).forEach(([f, msgs]) => {
          addLog(` -> ${f}: ${msgs.join(", ")}`);
        });
      }
    } else if (data) {
      addLog(`Service created: ${data.name} (${data.id}) at ${formatRupees(data.price)}`);
      setCreateForm({
        name: "",
        description: "",
        rupees: "",
      });
      loadServices();
    }
  };

  // Select service for view/edit
  const handleSelectService = (service: ServiceOffering) => {
    setSelectedService(service);
    setEditForm({
      name: service.name,
      description: service.description || "",
      rupees: (service.price / 100).toString(),
    });
    addLog(`Selected service: ${service.name} (${service.id})`);
  };

  // Update service handler
  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    setIsLoadingAction("update");

    let paise: number | undefined = undefined;
    if (editForm.rupees.trim() !== "") {
      const rupeeVal = parseFloat(editForm.rupees);
      if (isNaN(rupeeVal) || rupeeVal < 0) {
        addLog("Error: Please provide a valid positive price in rupees.");
        setIsLoadingAction(null);
        return;
      }
      paise = Math.round(rupeeVal * 100);
    }

    addLog(`Updating service ${selectedService.id}...`);

    const { data, error } = await serviceClient.updateService(selectedService.id, {
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      price: paise,
    });

    setIsLoadingAction(null);

    if (error) {
      addLog(`Error [${error.code}]: ${error.message}`);
      if (error.details) {
        Object.entries(error.details).forEach(([f, msgs]) => {
          addLog(` -> ${f}: ${msgs.join(", ")}`);
        });
      }
    } else if (data) {
      addLog(`Service updated successfully: ${data.name} (${formatRupees(data.price)})`);
      setSelectedService(data);
      loadServices();
    }
  };

  // Delete service handler
  const handleDeleteService = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete service "${name}"?`)) {
      return;
    }

    setIsLoadingAction(`delete-${id}`);
    addLog(`Deleting service ${id}...`);

    const { error } = await serviceClient.deleteService(id);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Delete failed [${error.code}]: ${error.message}`);
    } else {
      addLog(`Service ${id} deleted successfully.`);
      if (selectedService?.id === id) {
        setSelectedService(null);
      }
      loadServices();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">KaamSetu Services Testbed</h1>
              <span className="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Level 4 Module
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Multi-tenant catalog of services with minor-unit integer pricing (paise).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/dashboard"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              &larr; Dashboard
            </Link>
            <Link
              href="/dev/customers"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Customers
            </Link>
            <Link
              href="/dev/business"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Business
            </Link>
            <Link
              href="/dev/auth"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Auth
            </Link>
          </div>
        </header>

        {/* Business & Tenant Context */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 text-xs">
          <h2 className="font-semibold text-sm mb-2 text-zinc-900 dark:text-zinc-100">
            Current Tenant Context
          </h2>
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
                <span className="text-zinc-400">Caller:</span>{" "}
                <span>{user?.name}</span> ({user?.email})
              </div>
              <div>
                <span className="text-zinc-400">Role:</span>{" "}
                <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {businessData.member.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-amber-600 dark:text-amber-400">
              You do not have an active business. Please visit{" "}
              <Link href="/dev/business" className="underline font-bold">
                Dev Business
              </Link>{" "}
              to establish a business first.
            </div>
          )}
        </section>

        {/* Main Grid: Create Service Form & Services List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Service Form */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold mb-3">Add New Service Offering</h2>
              <form onSubmit={handleCreateService} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. AC Installation / AC Jet Servicing"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Price in Rupees (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1.5 text-zinc-400">₹</span>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0"
                      value={createForm.rupees}
                      onChange={(e) => setCreateForm({ ...createForm, rupees: e.target.value })}
                      placeholder="e.g. 500"
                      className="w-full rounded-md border border-zinc-300 pl-7 pr-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Stored as minor units:{" "}
                    <strong>
                      {isNaN(parseFloat(createForm.rupees))
                        ? "0"
                        : Math.round(parseFloat(createForm.rupees) * 100)}{" "}
                      paise
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="e.g. Complete indoor coil chemical wash, outdoor fan cleaning, filter replacement"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingAction === "create" || !businessData}
                  className="w-full rounded-md bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isLoadingAction === "create" ? "Saving..." : "Create Service Offering"}
                </button>
              </form>
            </section>

            {/* Edit Selected Service */}
            {selectedService && (
              <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    Edit: {selectedService.name}
                  </h2>
                  <button
                    onClick={() => setSelectedService(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
                <form onSubmit={handleUpdateService} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editForm.rupees}
                      onChange={(e) => setEditForm({ ...editForm, rupees: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Converted:{" "}
                      <strong>
                        {isNaN(parseFloat(editForm.rupees))
                          ? "0"
                          : Math.round(parseFloat(editForm.rupees) * 100)}{" "}
                        paise
                      </strong>
                    </p>
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingAction === "update"}
                    className="w-full rounded-md bg-indigo-700 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 dark:bg-indigo-600"
                  >
                    {isLoadingAction === "update" ? "Updating..." : "Save Changes"}
                  </button>
                </form>
              </section>
            )}
          </div>

          {/* Services Directory List */}
          <div className="lg:col-span-7 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Service Catalog Directory</h2>
                  <p className="text-xs text-zinc-500">
                    {services.length} service offering(s) configured for this business
                  </p>
                </div>
                <button
                  onClick={loadServices}
                  disabled={isLoadingServices}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isLoadingServices ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {services.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                  No services found. Add your first service offering using the form on the left.
                </div>
              ) : (
                <div className="space-y-3">
                  {services.map((s) => (
                    <div
                      key={s.id}
                      className={`rounded-lg border p-4 transition-colors ${
                        selectedService?.id === s.id
                          ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-500 dark:bg-indigo-950/20"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                              {s.name}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400">
                              {s.id}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <span>{formatRupees(s.price)}</span>
                            <span className="font-mono text-[11px] font-normal text-zinc-400">
                              ({s.price} paise)
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                              {s.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectService(s)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteService(s.id, s.name)}
                            disabled={isLoadingAction === `delete-${s.id}`}
                            className="rounded px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Live Test Console Log */}
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
              <p className="text-zinc-500">Ready for service actions.</p>
            ) : (
              logs.map((log, idx) => <p key={idx}>{log}</p>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
