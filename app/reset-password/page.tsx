"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import AppLogo from "@/app/components/AppLogo";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function ResetPasswordPage() {
  const router = useRouter();
  // The recovery link signs the user in (Supabase parses the token from the URL),
  // so a signed-in user here is allowed to set a new password.
  const { user, loading: authLoading, updatePassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const err = await updatePassword(password);
      if (err) setError(err.message);
      else {
        setDone(true);
        setTimeout(() => router.replace("/"), 1500);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center pt-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 px-6 pt-8 pb-6 flex flex-col items-center gap-3">
          <AppLogo className="w-14 h-14 shadow-md rounded-[22%]" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Choose a new password for your account.</p>
        </div>

        <div className="px-6 pb-6 pt-2">
          {authLoading ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : done ? (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 text-sm text-green-700 dark:text-green-300">
              Password updated! Taking you to your collection…
            </div>
          ) : !user ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-500 dark:text-red-400">
                This reset link is invalid or has expired. Request a new one from the sign-in screen.
              </p>
              <Link href="/" className="inline-block text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
              >
                {loading ? "Please wait…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
