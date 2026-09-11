"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { customerClient } from "@/lib/api/customer-client";
import { businessClient } from "@/lib/api/business-client";
import { Customer } from "@/backend/src/modules/customers/customer.types";
import { Business } from "@/backend/src/modules/business/business.types";
import { BusinessMember } from "@/backend/src/modules/members/member.types";
import { useAuth } from "@/lib/auth/auth-context";

export default function DevCustomersPage() {
  const { user } = useAuth();

  // Business context
  const [businessData, setBusinessData] = useState<{
    business: Business;
    member: BusinessMember;
  } | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);

  // Customers list state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Create Customer state
  const [createForm, setCreateForm] = useState({
    name: "Sunil Verma",
    phone: "9876543210",
    email: "sunil.verma@example.com",
    address: "B-42, Defence Colony, New Delhi",
  });

  // Selected / Edit Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Console output
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  // Fetch business & membership and initial customers list
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
        customerClient.listCustomers().then(({ data: cList, error: cErr }) => {
          if (!isMounted) return;
          if (cErr) {
            addLog(`List customers failed: [${cErr.code}] ${cErr.message}`);
          } else if (cList) {
            setCustomers(cList);
            addLog(`Retrieved ${cList.length} customer records.`);
          }
        });
      }
      setIsLoadingBusiness(false);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Load customers on manual refresh or after mutations
  const loadCustomers = () => {
    setIsLoadingCustomers(true);
    customerClient.listCustomers().then(({ data, error }) => {
      setIsLoadingCustomers(false);
      if (error) {
        addLog(`List customers failed: [${error.code}] ${error.message}`);
      } else if (data) {
        setCustomers(data);
        addLog(`Retrieved ${data.length} customer records.`);
      }
    });
  };

  // Create customer handler
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction("create");
    addLog(`Creating customer: "${createForm.name}"...`);

    const { data, error } = await customerClient.createCustomer({
      name: createForm.name,
      phone: createForm.phone,
      email: createForm.email || undefined,
      address: createForm.address || undefined,
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
      addLog(`Customer created: ${data.name} (${data.id})`);
      setCreateForm({
        name: "",
        phone: "",
        email: "",
        address: "",
      });
      loadCustomers();
    }
  };

  // Select customer for view/edit
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
    });
    addLog(`Selected customer: ${customer.name} (${customer.id})`);
  };

  // Update customer handler
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setIsLoadingAction("update");
    addLog(`Updating customer ${selectedCustomer.id}...`);

    const { data, error } = await customerClient.updateCustomer(selectedCustomer.id, {
      name: editForm.name || undefined,
      phone: editForm.phone || undefined,
      email: editForm.email || undefined,
      address: editForm.address || undefined,
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
      addLog(`Customer updated successfully: ${data.name}`);
      setSelectedCustomer(data);
      loadCustomers();
    }
  };

  // Delete customer handler
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"?`)) {
      return;
    }

    setIsLoadingAction(`delete-${id}`);
    addLog(`Deleting customer ${id}...`);

    const { error } = await customerClient.deleteCustomer(id);
    setIsLoadingAction(null);

    if (error) {
      addLog(`Delete failed [${error.code}]: ${error.message}`);
    } else {
      addLog(`Customer ${id} deleted successfully.`);
      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }
      loadCustomers();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans p-6 sm:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">KaamSetu Customers Testbed</h1>
              <span className="rounded bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                Level 3 Module
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Multi-tenant customer directory scoped by Business partition.
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

        {/* Business & Tenant Status */}
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

        {/* Main Grid: Create Customer Form & Customers List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Customer Form */}
          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold mb-3">Add New Customer</h2>
              <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Sunil Verma"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Phone (10-digit Indian mobile) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="e.g. sunil@example.com"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-zinc-600 dark:text-zinc-400 mb-1">
                    Address (Service Location)
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    placeholder="e.g. Flat 301, Tower 5, Sector 62, Noida"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoadingAction === "create" || !businessData}
                  className="w-full rounded-md bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {isLoadingAction === "create" ? "Saving..." : "Create Customer"}
                </button>
              </form>
            </section>

            {/* Edit Selected Customer */}
            {selectedCustomer && (
              <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/50 dark:bg-sky-950/20">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                    Edit Customer: {selectedCustomer.name}
                  </h2>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
                <form onSubmit={handleUpdateCustomer} className="space-y-3 text-xs">
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
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-600 dark:text-zinc-400 mb-1">Address</label>
                    <textarea
                      rows={2}
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingAction === "update"}
                    className="w-full rounded-md bg-sky-700 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50 dark:bg-sky-600"
                  >
                    {isLoadingAction === "update" ? "Updating..." : "Save Changes"}
                  </button>
                </form>
              </section>
            )}
          </div>

          {/* Customers Directory List */}
          <div className="lg:col-span-7 space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold">Customers Directory</h2>
                  <p className="text-xs text-zinc-500">
                    {customers.length} total customer(s) registered under this business
                  </p>
                </div>
                <button
                  onClick={loadCustomers}
                  disabled={isLoadingCustomers}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {isLoadingCustomers ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {customers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-xs text-zinc-500 dark:border-zinc-700">
                  No customers found. Create your first customer record using the form on the left.
                </div>
              ) : (
                <div className="space-y-3">
                  {customers.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg border p-3.5 transition-colors ${
                        selectedCustomer?.id === c.id
                          ? "border-sky-500 bg-sky-50/30 dark:border-sky-500 dark:bg-sky-950/20"
                          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                              {c.name}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-400">
                              {c.id}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                            <span>Phone: <strong>{c.phone}</strong></span>
                            {c.email && <span>Email: {c.email}</span>}
                          </div>
                          {c.address && (
                            <p className="mt-1 text-xs text-zinc-500">
                              Addr: {c.address}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectCustomer(c)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                            disabled={isLoadingAction === `delete-${c.id}`}
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
              <p className="text-zinc-500">Ready for customer actions.</p>
            ) : (
              logs.map((log, idx) => <p key={idx}>{log}</p>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
