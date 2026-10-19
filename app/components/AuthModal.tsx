"use client";

import { useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/appInfo";
import { useAuth } from "@/lib/auth";
import { PokeBallIcon } from "./Icons";

export default function AuthModal() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode]         = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const err = await signIn(email, password);
        if (err) setError(err.message);
        // On success, user state updates → home page unmounts this modal
      } else if (mode === "forgot") {
        const err = await resetPassword(email);
        if (err) setError(err.message);
        else setConfirmed(true);
      } else {
        const err = await signUp(email, password);
        if (err) setError(err.message);
        else setConfirmed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "signin" | "signup" | "forgot") {
    setMode(next);
    setError(null);
    setConfirmed(false);
  }

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="dialog-in bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-b from-red-50 to-white dark:from-gray-700 dark:to-gray-800 px-6 pt-8 pb-6 flex flex-col items-center gap-3">
          <PokeBallIcon className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {mode === "signin"
              ? "Sign in to access your collection."
              : mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Create an account to start tracking."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {confirmed ? (
            <div className="rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 text-sm text-green-700 dark:text-green-300">
              {mode === "forgot"
                ? "If an account exists for that email, a password reset link is on its way."
                : "Account created! Check your email to confirm, then sign in."}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {mode !== "forgot" && (
                  <input
                    type="password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {mode === "signin" && (
                <div className="-mt-2 text-right">
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline">
                    Forgot password?
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
              >
                {loading ? "Please wait…" : mode === "signin" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Create Account"}
              </button>
            </>
          )}

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {mode === "signin" ? (
              <>No account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Sign up
                </button>
              </>
            ) : (
              <>{mode === "forgot" ? "Remembered it?" : "Already have an account?"}{" "}
                <button type="button" onClick={() => switchMode("signin")} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>

        <p className="pb-5 -mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/support" className="hover:underline">Support</Link>
          {" · "}
          <Link href="/feedback?from=/sign-in" className="hover:underline">Feedback</Link>
        </p>
      </div>
    </div>
  );
}
