"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ChevronRightIcon } from "@/app/components/Icons";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
const cardClass = "bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin, signOut, updatePassword, deleteAccount } = useAuth();

  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [pwMessage, setPwMessage]     = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving]       = useState(false);

  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteText, setDeleteText]   = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setPwMessage({ ok: false, text: "Passwords don't match." });
      return;
    }
    setPwSaving(true);
    try {
      const err = await updatePassword(password);
      setPwMessage(err ? { ok: false, text: err.message } : { ok: true, text: "Password updated." });
      if (!err) { setPassword(""); setConfirm(""); }
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const err = await deleteAccount();
    setDeleting(false);
    if (err) setDeleteError(err);
    else router.replace("/");
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">Account</span>
      </nav>

      <section className={cardClass}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-all">Signed in as {user.email}</p>
        <button
          onClick={signOut}
          className="mt-4 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Sign out
        </button>
      </section>

      {isAdmin && (
        <Link href="/admin" className={`${cardClass} flex items-center justify-between hover:border-blue-400 transition-colors`}>
          <span>
            <span className="block text-lg font-bold text-gray-900 dark:text-gray-100">Admin dashboard</span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">Feedback, users, announcements</span>
          </span>
          <ChevronRightIcon className="w-5 h-5 text-gray-400" />
        </Link>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Change password</h2>
        <form onSubmit={handlePassword} className="space-y-3">
          <input type="password" required minLength={6} autoComplete="new-password" placeholder="New password"
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <input type="password" required minLength={6} autoComplete="new-password" placeholder="Confirm new password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          {pwMessage && (
            <p className={`text-sm ${pwMessage.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>{pwMessage.text}</p>
          )}
          <button type="submit" disabled={pwSaving}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors">
            {pwSaving ? "Please wait…" : "Update Password"}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">About</h2>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/privacy" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Privacy Policy</Link>
          <Link href="/support" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Help &amp; Support</Link>
          <Link href="/feedback?from=/account" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Send Feedback or Report a Bug</Link>
        </div>
      </section>

      <section className={`${cardClass} border-red-200 dark:border-red-900`}>
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Delete account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Permanently deletes your account, master sets, collection and portfolio history. This can’t be undone.
        </p>
        {!deleteOpen ? (
          <button onClick={() => setDeleteOpen(true)}
            className="mt-4 px-4 py-2.5 min-h-[44px] rounded-xl border border-red-300 dark:border-red-800 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
            Delete Account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
              <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoCapitalize="characters"
                className={`${inputClass} mt-2`} aria-label="Type DELETE to confirm" />
            </label>
            {deleteError && <p className="text-sm text-red-500 dark:text-red-400">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setDeleteText(""); setDeleteError(null); }}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleteText !== "DELETE" || deleting}
                className="flex-1 py-2.5 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors">
                {deleting ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
