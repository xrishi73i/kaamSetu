"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/api/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await authClient.forgotPassword({ email });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setStatusMessage(
        data?.message ||
          "If your email is registered, password reset instructions have been dispatched."
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-center">
          <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">
            Level 1 · Authentication
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reset Password
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email to receive password reset instructions.
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">
          <strong>Notice:</strong> In development, this uses the mock provider flow. Production password recovery will be integrated directly via AWS Cognito.
        </div>

        {errorMessage && (
          <div
            id="forgot-error-alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div
            id="forgot-success-alert"
            className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
          >
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              placeholder="rishi@example.com"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <button
            id="forgot-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
          >
            {isSubmitting ? "Sending..." : "Send Reset Instructions"}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
