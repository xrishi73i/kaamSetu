"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/api/auth-client";
import { AuthUser } from "@/backend/src/modules/auth/auth.types";

export default function DevAuthPage() {
  // Sign up state
  const [signupForm, setSignupForm] = useState({
    name: "Rishi Kumar",
    email: "rishi@example.com",
    phone: "9876543210",
    password: "Password123!",
  });

  // Sign in state
  const [signinForm, setSigninForm] = useState({
    email: "rishi@example.com",
    password: "Password123!",
  });

  // Me state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Protected test state
  const [protectedResult, setProtectedResult] = useState<string | null>(null);

  // General action output log
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogMessages((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("signup");
    addLog(`Initiating signup for ${signupForm.email}...`);

    const { data, error } = await authClient.signUp({
      name: signupForm.name,
      email: signupForm.email,
      phone: signupForm.phone,
      password: signupForm.password,
    });

    setLoadingAction(null);
    if (error) {
      addLog(`❌ SIGNUP ERROR (${error.code}): ${error.message}`);
    } else if (data) {
      setCurrentUser(data.user);
      addLog(`✅ SIGNUP SUCCESS: User created (${data.user.id})`);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction("signin");
    addLog(`Initiating signin for ${signinForm.email}...`);

    const { data, error } = await authClient.signIn(signinForm);

    setLoadingAction(null);
    if (error) {
      addLog(`❌ SIGNIN ERROR (${error.code}): ${error.message}`);
    } else if (data) {
      setCurrentUser(data.user);
      addLog(`✅ SIGNIN SUCCESS: Authenticated as ${data.user.email} (${data.user.id})`);
    }
  };

  const handleGetMe = async () => {
    setLoadingAction("get_me");
    addLog("Executing GET /api/v1/auth/me...");

    const { data, error } = await authClient.getMe();

    setLoadingAction(null);
    if (error) {
      setCurrentUser(null);
      addLog(`❌ GET /ME ERROR (${error.code}): ${error.message}`);
    } else if (data) {
      setCurrentUser(data);
      addLog(`✅ GET /ME SUCCESS: Current user is ${data.name} (${data.id})`);
    }
  };

  const handleLogout = async () => {
    setLoadingAction("logout");
    addLog("Executing POST /api/v1/auth/logout...");

    const { data, error } = await authClient.signOut();

    setLoadingAction(null);
    if (error) {
      addLog(`❌ LOGOUT ERROR (${error.code}): ${error.message}`);
    } else {
      setCurrentUser(null);
      addLog(`✅ LOGOUT SUCCESS: ${data?.message || "Session ended."}`);
    }
  };

  const handleCallProtected = async () => {
    setLoadingAction("call_protected");
    addLog("Calling GET /api/v1/test/protected...");

    const { data, error } = await authClient.testProtectedEndpoint();

    setLoadingAction(null);
    if (error) {
      const errStr = `FAILED (${error.code}): ${error.message}`;
      setProtectedResult(errStr);
      addLog(`❌ PROTECTED ENDPOINT: ${errStr}`);
    } else if (data) {
      const succStr = `SUCCESS: ${data.message} [User: ${data.authenticatedUser?.id} (${data.authenticatedUser?.email})]`;
      setProtectedResult(succStr);
      addLog(`✅ PROTECTED ENDPOINT: ${succStr}`);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 p-6 font-mono text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="border-b border-zinc-300 pb-4 dark:border-zinc-800">
          <h1 className="text-xl font-bold tracking-wider">KAAMSETU AUTH TEST</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Level 1 Developer Testbench · Development/Mock Identity Provider
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: SIGN UP & SIGN IN */}
          <div className="space-y-6">
            {/* SIGN UP */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                SIGN UP
              </h2>
              <form onSubmit={handleSignUp} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Name</label>
                  <input
                    id="dev-signup-name"
                    type="text"
                    value={signupForm.name}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, name: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Email</label>
                  <input
                    id="dev-signup-email"
                    type="email"
                    value={signupForm.email}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, email: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Phone</label>
                  <input
                    id="dev-signup-phone"
                    type="text"
                    value={signupForm.phone}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, phone: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Password</label>
                  <input
                    id="dev-signup-password"
                    type="password"
                    value={signupForm.password}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, password: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <button
                  id="dev-signup-submit-btn"
                  type="submit"
                  disabled={loadingAction === "signup"}
                  className="w-full rounded bg-zinc-900 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loadingAction === "signup" ? "SIGNING UP..." : "SIGN UP"}
                </button>
              </form>
            </section>

            {/* SIGN IN */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                SIGN IN
              </h2>
              <form onSubmit={handleSignIn} className="space-y-3 text-xs">
                <div>
                  <label className="block text-zinc-500 mb-1">Email</label>
                  <input
                    id="dev-signin-email"
                    type="email"
                    value={signinForm.email}
                    onChange={(e) =>
                      setSigninForm({ ...signinForm, email: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">Password</label>
                  <input
                    id="dev-signin-password"
                    type="password"
                    value={signinForm.password}
                    onChange={(e) =>
                      setSigninForm({ ...signinForm, password: e.target.value })
                    }
                    className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
                <button
                  id="dev-signin-submit-btn"
                  type="submit"
                  disabled={loadingAction === "signin"}
                  className="w-full rounded bg-zinc-900 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {loadingAction === "signin" ? "SIGNING IN..." : "SIGN IN"}
                </button>
              </form>
            </section>
          </div>

          {/* Column 2: CURRENT USER, LOGOUT, PROTECTED TEST */}
          <div className="space-y-6">
            {/* CURRENT USER */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                <h2 className="font-bold text-sm">CURRENT USER</h2>
                <button
                  id="dev-get-me-btn"
                  onClick={handleGetMe}
                  disabled={loadingAction === "get_me"}
                  className="rounded bg-zinc-200 px-3 py-1 text-xs font-bold hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {loadingAction === "get_me" ? "FETCHING..." : "GET /ME"}
                </button>
              </div>

              <div id="dev-user-details" className="text-xs space-y-1.5 font-mono">
                {currentUser ? (
                  <div className="bg-zinc-50 p-3 rounded border border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-700">
                    <p>
                      <strong>User ID:</strong> <span id="dev-user-id">{currentUser.id}</span>
                    </p>
                    <p>
                      <strong>Name:</strong> <span id="dev-user-name">{currentUser.name}</span>
                    </p>
                    <p>
                      <strong>Email:</strong> <span id="dev-user-email">{currentUser.email}</span>
                    </p>
                    <p>
                      <strong>Phone:</strong> <span id="dev-user-phone">{currentUser.phone}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-zinc-400 italic">No authenticated user state loaded.</p>
                )}
              </div>
            </section>

            {/* LOGOUT */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="font-bold text-sm border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                SESSION TERMINATION
              </h2>
              <button
                id="dev-logout-btn"
                onClick={handleLogout}
                disabled={loadingAction === "logout"}
                className="w-full rounded bg-red-600 py-2 font-bold text-xs text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loadingAction === "logout" ? "TERMINATING..." : "LOGOUT"}
              </button>
            </section>

            {/* PROTECTED TEST */}
            <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3 dark:border-zinc-800">
                <h2 className="font-bold text-sm">PROTECTED TEST</h2>
                <button
                  id="dev-call-protected-btn"
                  onClick={handleCallProtected}
                  disabled={loadingAction === "call_protected"}
                  className="rounded bg-zinc-900 px-3 py-1 text-xs font-bold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  CALL PROTECTED ENDPOINT
                </button>
              </div>

              <div className="text-xs">
                <div
                  id="dev-protected-result"
                  className="p-3 rounded bg-zinc-50 border border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-700 font-mono break-all"
                >
                  {protectedResult ? (
                    <span
                      className={
                        protectedResult.startsWith("SUCCESS")
                          ? "text-emerald-600 dark:text-emerald-400 font-bold"
                          : "text-red-600 dark:text-red-400 font-bold"
                      }
                    >
                      {protectedResult}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">No endpoint test run yet.</span>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Live Event & API Log */}
        <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-2 dark:border-zinc-800">
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500">
              Live Console Output
            </h3>
            <button
              onClick={() => setLogMessages([])}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 underline"
            >
              Clear
            </button>
          </div>
          <div
            id="dev-action-logs"
            className="max-h-48 overflow-y-auto space-y-1 font-mono text-xs text-zinc-700 dark:text-zinc-300"
          >
            {logMessages.length === 0 ? (
              <p className="text-zinc-400 italic text-[11px]">No activity logged yet.</p>
            ) : (
              logMessages.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
