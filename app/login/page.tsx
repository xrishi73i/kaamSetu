"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/dashboard";

  const { signIn, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (globalError) setGlobalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!formData.email.trim()) {
      setGlobalError("Please enter your email address.");
      return;
    }
    if (!formData.password) {
      setGlobalError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(formData);
    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        router.push(redirectTarget);
      }, 500);
    } else {
      setGlobalError(
        result.error?.message || "Invalid credentials or sign-in failed."
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-center">
          <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">
            Level 1 · Authentication
          </span>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to KaamSetu
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Access your service operations dashboard
          </p>
        </div>

        {globalError && (
          <div
            id="login-error-alert"
            className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
          >
            {globalError}
          </div>
        )}

        {isSuccess && (
          <div
            id="login-success-alert"
            className="rounded-lg bg-emerald-50 p-3.5 text-sm text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
          >
            Signed in successfully! Redirecting...
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
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="rishi@example.com"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={isSubmitting || authLoading || isSuccess}
            className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading sign-in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
