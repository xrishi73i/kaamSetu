import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans">
      <main className="w-full max-w-xl space-y-8 rounded-3xl bg-white p-10 shadow-sm border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 text-center">
        <div>
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-3">
            Level 1 · Authentication Engine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">KaamSetu</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The digital operating system for India&apos;s local service businesses.
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-6 border border-zinc-100 dark:bg-zinc-800/40 dark:border-zinc-800 text-left space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Level 1 Implementation Status
          </h2>
          <ul className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5 list-disc list-inside">
            <li>Provider Abstraction: MockAuthProvider (Active) / CognitoAuthProvider (Pending Handoff)</li>
            <li>HTTP-only cookie session management &amp; API Bearer token verification</li>
            <li>Centralized input validation (Name, Email, Phone, Password)</li>
            <li>Protected route proxy and server guard verification</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            id="home-register-btn"
            href="/register"
            className="flex items-center justify-center rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Create Account
          </Link>
          <Link
            id="home-login-btn"
            href="/login"
            className="flex items-center justify-center rounded-xl border border-zinc-300 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Sign In
          </Link>
          <Link
            id="home-dashboard-btn"
            href="/dashboard"
            className="flex items-center justify-center rounded-xl border border-zinc-300 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Protected Dashboard
          </Link>
          <Link
            id="home-dev-auth-btn"
            href="/dev/auth"
            className="flex items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Dev Auth Testbed
          </Link>
        </div>
      </main>
    </div>
  );
}
