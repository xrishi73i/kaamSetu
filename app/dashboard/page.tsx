"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authClient } from "@/lib/api/auth-client";
import { businessClient } from "@/lib/api/business-client";
import { Business } from "@/backend/src/modules/business/business.types";
import { BusinessMember } from "@/backend/src/modules/members/member.types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [protectedResult, setProtectedResult] = useState<string | null>(null);
  const [isCallingProtected, setIsCallingProtected] = useState(false);

  // Business state
  const [businessData, setBusinessData] = useState<{
    business: Business;
    member: BusinessMember;
  } | null>(null);
  const [isLoadingBusiness, setIsLoadingBusiness] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    businessClient.getBusiness().then(({ data }) => {
      if (isMounted) {
        setBusinessData(data || null);
        setIsLoadingBusiness(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleTestProtected = async () => {
    setIsCallingProtected(true);
    setProtectedResult(null);

    const { data, error } = await authClient.testProtectedEndpoint();
    setIsCallingProtected(false);

    if (error) {
      setProtectedResult(`Error (${error.code}): ${error.message}`);
    } else if (data) {
      setProtectedResult(
        `Success: ${data.message} [User: ${data.authenticatedUser?.name} (${data.authenticatedUser?.email})]`
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 text-center border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Access Denied</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You must be signed in to view this protected application route.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Navigation Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-lg">KaamSetu</span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              Level 5 · Jobs
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/dev/auth"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Auth
            </Link>
            <Link
              href="/dev/business"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Business
            </Link>
            <Link
              href="/dev/customers"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Customers
            </Link>
            <Link
              href="/dev/services"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Dev Services
            </Link>
            <Link
              href="/dev/jobs"
              className="text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 font-semibold underline"
            >
              Dev Jobs
            </Link>
            <button
              id="dashboard-logout-btn"
              onClick={handleSignOut}
              className="rounded-lg border border-zinc-300 px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operator Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Digital operating system for India&apos;s local service businesses
          </p>
        </div>

        {/* Business & Tenant Status Section */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Service Business Association
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Level 2 Tenant Structure · User → BusinessMember → Business
              </p>
            </div>
            <Link
              href="/dev/business"
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Manage Business
            </Link>
          </div>

          {isLoadingBusiness ? (
            <p className="mt-4 text-xs text-zinc-400">Loading business membership...</p>
          ) : businessData ? (
            <div className="mt-4 rounded-xl bg-zinc-50 p-4 border border-zinc-100 dark:bg-zinc-800/60 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {businessData.business.name}
                  </h3>
                  <p className="text-xs text-zinc-500">{businessData.business.address}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {businessData.member.role}
                </span>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 flex gap-6 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                <span><strong>Phone:</strong> {businessData.business.phone}</span>
                <span><strong>Business ID:</strong> <span className="font-mono">{businessData.business.id}</span></span>
                <span><strong>Membership:</strong> {businessData.member.status}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span>You have not established or joined a service business yet.</span>
              <Link
                href="/dev/business"
                className="font-bold underline hover:text-amber-950 dark:hover:text-amber-100"
              >
                Create Business &rarr;
              </Link>
            </div>
          )}
        </section>

        {/* Current Authenticated User Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Authenticated Identity Details
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Retrieved via secure session cookie and backend /api/v1/auth/me
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100 dark:bg-zinc-800/60 dark:border-zinc-800">
              <dt className="text-xs font-medium text-zinc-500">User ID</dt>
              <dd id="user-id-display" className="mt-1 font-mono text-sm font-semibold truncate">
                {user.id}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100 dark:bg-zinc-800/60 dark:border-zinc-800">
              <dt className="text-xs font-medium text-zinc-500">Full Name</dt>
              <dd id="user-name-display" className="mt-1 text-sm font-semibold">
                {user.name}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100 dark:bg-zinc-800/60 dark:border-zinc-800">
              <dt className="text-xs font-medium text-zinc-500">Email Address</dt>
              <dd id="user-email-display" className="mt-1 text-sm font-semibold truncate">
                {user.email}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-100 dark:bg-zinc-800/60 dark:border-zinc-800">
              <dt className="text-xs font-medium text-zinc-500">Phone</dt>
              <dd id="user-phone-display" className="mt-1 text-sm font-semibold">
                {user.phone}
              </dd>
            </div>
          </dl>
        </section>

        {/* Protected API Test Card */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Backend Guard Verification
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Call /api/v1/test/protected to verify backend authentication middleware guard.
            </p>
          </div>

          <div>
            <button
              id="call-protected-api-btn"
              onClick={handleTestProtected}
              disabled={isCallingProtected}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
            >
              {isCallingProtected ? "Invoking API..." : "Invoke Protected Endpoint"}
            </button>
          </div>

          {protectedResult && (
            <div
              id="protected-api-result"
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 break-all"
            >
              {protectedResult}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
