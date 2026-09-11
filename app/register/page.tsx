"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error upon typing
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (globalError) setGlobalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    // Client-side quick checks
    const clientErrors: Record<string, string[]> = {};
    if (!formData.name.trim()) {
      clientErrors.name = ["Name is required."];
    }
    if (!formData.email.trim()) {
      clientErrors.email = ["Email is required."];
    }
    if (!formData.phone.trim()) {
      clientErrors.phone = ["Phone number is required."];
    }
    if (!formData.password) {
      clientErrors.password = ["Password is required."];
    } else if (formData.password.length < 8) {
      clientErrors.password = ["Password must be at least 8 characters long."];
    }
    if (formData.password !== formData.confirmPassword) {
      clientErrors.confirmPassword = ["Passwords do not match."];
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(formData);
    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } else {
      if (result.error?.details) {
        setErrors(result.error.details);
      }
      setGlobalError(result.error?.message || "Failed to create account. Please try again.");
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
            Create your KaamSetu account
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Digital operating system for India&apos;s local service businesses
          </p>
        </div>

        {globalError && (
          <div
            id="register-error-alert"
            className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300"
          >
            {globalError}
          </div>
        )}

        {isSuccess && (
          <div
            id="register-success-alert"
            className="rounded-lg bg-emerald-50 p-3.5 text-sm text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
          >
            Account created successfully! Redirecting to dashboard...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Full Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="e.g. Rishi Kumar"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.name[0]}
              </p>
            )}
          </div>

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
            {errors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.email[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              value={formData.phone}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="9876543210"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {errors.phone && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.phone[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.password[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={isSubmitting || authLoading}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.confirmPassword[0]}
              </p>
            )}
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            disabled={isSubmitting || authLoading || isSuccess}
            className="w-full rounded-lg bg-zinc-900 py-3 text-sm font-medium text-white shadow hover:bg-zinc-800 disabled:opacity-50 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
