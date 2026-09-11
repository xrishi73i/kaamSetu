"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { businessClient } from "@/lib/api/business-client";
import { Business } from "@/backend/src/modules/business/business.types";
import { BusinessMember, BusinessMemberRole, BusinessMemberStatus } from "@/backend/src/modules/members/member.types";
import { useAuth } from "@/lib/auth/auth-context";

export default function DevBusinessPage() {
  const { user } = useAuth();

  // Create Business state
  const [createForm, setCreateForm] = useState({
    name: "Rishi Cooling Services",
    phone: "9876543210",
    address: "Plot 42, Okhla Phase III, New Delhi",
  });

  // Current Business & Membership state
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [currentMembership, setCurrentMembership] = useState<BusinessMember | null>(null);

  // Update Business state
  const [updateForm, setUpdateForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  // Members list state
  const [members, setMembers] = useState<BusinessMember[]>([]);

  // Invite Member state
  const [inviteForm, setInviteForm] = useState<{
    name: string;
    email: string;
    phone: string;
    role: BusinessMemberRole;
  }>({
    name: "Suresh Sharma",
    email: "suresh@example.com",
    phone: "9811223344",
    role: "TECHNICIAN",
  });

  // Member update state
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<BusinessMemberRole>("TECHNICIAN");
  const [selectedStatus, setSelectedStatus] = useState<BusinessMemberStatus>("ACTIVE");

  // Console output
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingAction, setIsLoadingAction] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const fetchBusiness = useCallback(async () => {
    setIsLoadingAction("fetch_biz");
    addLog("GET /api/v1/business...");
    const { data, error } = await businessClient.getBusiness();
    setIsLoadingAction(null);

    if (error) {
      setCurrentBusiness(null);
      setCurrentMembership(null);
      setMembers([]);
      addLog(`❌ GET BUSINESS: [${error.code}] ${error.message}`);
    } else if (data) {
      setCurrentBusiness(data.business);
      setCurrentMembership(data.member);
      setUpdateForm({
        name: data.business.name,
        phone: data.business.phone,
        address: data.business.address,
      });
      addLog(`✅ BUSINESS LOADED: ${data.business.name} (Role: ${data.member.role})`);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setIsLoadingAction("fetch_members");
    addLog("GET /api/v1/business/members...");
    const { data, error } = await businessClient.listMembers();
    setIsLoadingAction(null);

    if (error) {
      addLog(`❌ LIST MEMBERS: [${error.code}] ${error.message}`);
    } else if (data) {
      setMembers(data);
      if (data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
        setSelectedRole(data[0].role);
        setSelectedStatus(data[0].status);
      }
      addLog(`✅ ${data.length} MEMBERS RETRIEVED.`);
    }
  }, [selectedMemberId]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    businessClient.getBusiness().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setCurrentBusiness(null);
        setCurrentMembership(null);
        setMembers([]);
      } else if (data) {
        setCurrentBusiness(data.business);
        setCurrentMembership(data.member);
        setUpdateForm({
          name: data.business.name,
          phone: data.business.phone,
          address: data.business.address,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!currentBusiness) return;
    let isMounted = true;
    businessClient.listMembers().then(({ data }) => {
      if (!isMounted) return;
      if (data) {
        setMembers(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentBusiness]);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction("create_biz");
    addLog(`Creating business: "${createForm.name}"...`);

    const { data, error } = await businessClient.createBusiness(createForm);
    setIsLoadingAction(null);

    if (error) {
      addLog(`❌ CREATE FAILED: [${error.code}] ${error.message}`);
    } else if (data) {
      setCurrentBusiness(data.business);
      setCurrentMembership(data.member);
      addLog(`✅ BUSINESS CREATED: ${data.business.name} (ID: ${data.business.id})`);
      fetchMembers();
    }
  };

  const handleUpdateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction("update_biz");
    addLog("PATCH /api/v1/business...");

    const { data, error } = await businessClient.updateBusiness(updateForm);
    setIsLoadingAction(null);

    if (error) {
      addLog(`❌ UPDATE FAILED: [${error.code}] ${error.message}`);
    } else if (data) {
      setCurrentBusiness(data);
      addLog(`✅ BUSINESS UPDATED: ${data.name}`);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingAction("invite_mem");
    addLog(`Inviting member: ${inviteForm.name} (${inviteForm.role})...`);

    const { data, error } = await businessClient.inviteMember(inviteForm);
    setIsLoadingAction(null);

    if (error) {
      addLog(`❌ INVITE FAILED: [${error.code}] ${error.message}`);
    } else if (data) {
      addLog(`✅ MEMBER ADDED: ${data.user?.name} (${data.role})`);
      fetchMembers();
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    setIsLoadingAction("update_mem");
    addLog(`Updating member ${selectedMemberId}: Role -> ${selectedRole}, Status -> ${selectedStatus}...`);

    const { data, error } = await businessClient.updateMember(selectedMemberId, {
      role: selectedRole,
      status: selectedStatus,
    });
    setIsLoadingAction(null);

    if (error) {
      addLog(`❌ MEMBER UPDATE FAILED: [${error.code}] ${error.message}`);
    } else if (data) {
      addLog(`✅ MEMBER UPDATED: ${data.user?.name || data.id} [${data.role} | ${data.status}]`);
      fetchMembers();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-6 font-mono text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-300 pb-4 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-bold tracking-wider">KAAMSETU BUSINESS &amp; MEMBERS TESTBENCH</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Level 2 · Business Setup &amp; Multi-Tenant Membership Engine
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/dev/auth" className="underline hover:text-zinc-500">
              Dev Auth
            </Link>
            <Link href="/dashboard" className="underline hover:text-zinc-500">
              Dashboard
            </Link>
          </div>
        </div>

        {/* Current Auth Context Banner */}
        <div className="rounded border border-zinc-300 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 text-xs">
          <strong>Authenticated User: </strong>
          {user ? (
            <span>
              {user.name} ({user.email}) · ID: {user.id}
            </span>
          ) : (
            <span className="text-amber-600">Not signed in. Please sign in via Dev Auth first.</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: CREATE BUSINESS & CURRENT BUSINESS */}
          <div className="space-y-6">
            {/* Create Business */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                1. CREATE BUSINESS (POST)
              </h2>
              <form onSubmit={handleCreateBusiness} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Business Name</label>
                  <input
                    id="dev-biz-create-name"
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Phone</label>
                  <input
                    id="dev-biz-create-phone"
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Address</label>
                  <input
                    id="dev-biz-create-address"
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <button
                  id="dev-biz-create-submit"
                  type="submit"
                  disabled={isLoadingAction === "create_biz" || !user}
                  className="w-full rounded bg-zinc-900 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                >
                  {isLoadingAction === "create_biz" ? "CREATING..." : "CREATE BUSINESS"}
                </button>
              </form>
            </section>

            {/* Current Business Card & Update */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                <h2 className="font-bold text-sm">2. CURRENT BUSINESS (GET)</h2>
                <button
                  onClick={fetchBusiness}
                  disabled={isLoadingAction === "fetch_biz" || !user}
                  className="rounded bg-zinc-200 px-2.5 py-1 text-xs font-bold hover:bg-zinc-300 dark:bg-zinc-800"
                >
                  REFRESH
                </button>
              </div>

              {currentBusiness ? (
                <div className="space-y-4 text-xs">
                  <div className="rounded bg-zinc-50 p-3 border border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-700 space-y-1">
                    <p>
                      <strong>Business ID:</strong> {currentBusiness.id}
                    </p>
                    <p>
                      <strong>Name:</strong> {currentBusiness.name}
                    </p>
                    <p>
                      <strong>Phone:</strong> {currentBusiness.phone}
                    </p>
                    <p>
                      <strong>Address:</strong> {currentBusiness.address}
                    </p>
                    <p>
                      <strong>Your Role:</strong>{" "}
                      <span className="font-bold text-emerald-600">{currentMembership?.role}</span> (
                      {currentMembership?.status})
                    </p>
                  </div>

                  {/* Update Form */}
                  <form onSubmit={handleUpdateBusiness} className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold text-xs">UPDATE BUSINESS (PATCH)</h3>
                    <div>
                      <label className="block text-zinc-500 mb-1">New Name</label>
                      <input
                        type="text"
                        value={updateForm.name}
                        onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })}
                        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1">New Phone</label>
                      <input
                        type="text"
                        value={updateForm.phone}
                        onChange={(e) => setUpdateForm({ ...updateForm, phone: e.target.value })}
                        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1">New Address</label>
                      <input
                        type="text"
                        value={updateForm.address}
                        onChange={(e) => setUpdateForm({ ...updateForm, address: e.target.value })}
                        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoadingAction === "update_biz" || currentMembership?.role !== "OWNER"}
                      className="w-full rounded bg-zinc-800 py-2 font-bold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 cursor-pointer"
                    >
                      {isLoadingAction === "update_biz" ? "UPDATING..." : "UPDATE BUSINESS DETAILS"}
                    </button>
                    {currentMembership?.role !== "OWNER" && (
                      <p className="text-[10px] text-amber-600">Only OWNER can update business details.</p>
                    )}
                  </form>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">No business associated with current user.</p>
              )}
            </section>
          </div>

          {/* Column 2: MEMBERS & ACTIONS */}
          <div className="space-y-6">
            {/* Members Directory */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                <h2 className="font-bold text-sm">3. BUSINESS MEMBERS (GET)</h2>
                <button
                  onClick={fetchMembers}
                  disabled={isLoadingAction === "fetch_members" || !currentBusiness}
                  className="rounded bg-zinc-200 px-2.5 py-1 text-xs font-bold hover:bg-zinc-300 dark:bg-zinc-800"
                >
                  REFRESH
                </button>
              </div>

              {members.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMemberId(m.id);
                        setSelectedRole(m.role);
                        setSelectedStatus(m.status);
                      }}
                      className={`p-2.5 rounded border cursor-pointer transition-colors ${
                        selectedMemberId === m.id
                          ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
                      }`}
                    >
                      <div className="flex justify-between font-bold">
                        <span>{m.user?.name || m.userId}</span>
                        <span className="text-emerald-600">{m.role}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 flex justify-between mt-1">
                        <span>{m.user?.email || "No email"}</span>
                        <span>{m.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">No members found.</p>
              )}
            </section>

            {/* Invite Member */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                4. INVITE MEMBER (POST)
              </h2>
              <form onSubmit={handleInviteMember} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role: e.target.value as BusinessMemberRole })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="TECHNICIAN">TECHNICIAN</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isLoadingAction === "invite_mem" || !currentBusiness}
                  className="w-full rounded bg-zinc-900 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                >
                  {isLoadingAction === "invite_mem" ? "INVITING..." : "INVITE MEMBER"}
                </button>
              </form>
            </section>

            {/* Member Action (Role / Status) */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                5. MEMBER ACTIONS (PATCH)
              </h2>
              {selectedMemberId ? (
                <form onSubmit={handleUpdateMember} className="space-y-3 text-xs">
                  <p className="text-[11px] text-zinc-500">
                    Selected Member ID: <span className="font-bold text-zinc-900 dark:text-zinc-100">{selectedMemberId}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-500 mb-1">Role</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as BusinessMemberRole)}
                        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <option value="TECHNICIAN">TECHNICIAN</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1">Status</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as BusinessMemberStatus)}
                        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoadingAction === "update_mem" || currentMembership?.role !== "OWNER"}
                    className="w-full rounded bg-zinc-900 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 cursor-pointer"
                  >
                    {isLoadingAction === "update_mem" ? "SAVING..." : "SAVE MEMBER CHANGES"}
                  </button>
                  {currentMembership?.role !== "OWNER" && (
                    <p className="text-[10px] text-amber-600">Only OWNER can modify member roles/status.</p>
                  )}
                </form>
              ) : (
                <p className="text-xs text-zinc-500 italic">Select a member from the directory above.</p>
              )}
            </section>
          </div>
        </div>

        {/* Live Event Log */}
        <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-2 dark:border-zinc-800">
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500">Live Console Output</h3>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 underline"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {logs.length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">No activity logged yet.</p>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
