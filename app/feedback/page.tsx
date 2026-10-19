"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { APP_VERSION } from "@/lib/appInfo";
import { BugIcon, ChatIcon, LightBulbIcon } from "@/app/components/Icons";

type Kind = "bug" | "idea" | "other";

const KINDS: { value: Kind; label: string; Icon: typeof BugIcon }[] = [
  { value: "bug",   label: "Bug",   Icon: BugIcon },
  { value: "idea",  label: "Idea",  Icon: LightBulbIcon },
  { value: "other", label: "Other", Icon: ChatIcon },
];

const MAX_MESSAGE = 5000;

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

// Optional prefill: /feedback?kind=bug&from=/sets&message=…
export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackForm />
    </Suspense>
  );
}

function deviceInfo() {
  return `v${APP_VERSION} · ${Capacitor.getPlatform()} · ${navigator.userAgent}`.slice(0, 1000);
}

function FeedbackForm() {
  const params = useSearchParams();
  const initialKind = params.get("kind");
  const [kind, setKind]           = useState<Kind>(initialKind === "idea" || initialKind === "other" ? initialKind : "bug");
  const [message, setMessage]     = useState(params.get("message") ?? "");
  const [email, setEmail]         = useState("");
  const [includeDevice, setIncludeDevice] = useState(true);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [sent, setSent]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    // Deliberately no user ID: feedback is anonymous even when signed in. The
    // insert doesn't read the row back, since only admins can read feedback.
    const { error } = await supabase.from("feedback").insert({
      kind,
      message: message.trim(),
      contact_email: email.trim() || null,
      page: params.get("from")?.slice(0, 500) || null,
      app_info: includeDevice ? deviceInfo() : null,
    });
    setSending(false);
    if (error) setError("Couldn't send your feedback. Please try again in a minute.");
    else setSent(true);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">← Home</Link>

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Send feedback</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Found a bug or have an idea? Feedback is anonymous: it isn’t linked to your account.
        </p>

        {sent ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-4 text-sm text-green-700 dark:text-green-300">
              Thanks! Your feedback was sent{email.trim() ? " and we’ll reply by email if we need more details" : ""}.
            </div>
            <button
              onClick={() => { setSent(false); setMessage(""); }}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Send more feedback
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex gap-2" role="radiogroup" aria-label="Feedback type">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  onClick={() => setKind(k.value)}
                  className={`flex-1 px-3 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    kind === k.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-1.5"><k.Icon className="w-4 h-4" />{k.label}</span>
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {kind === "bug" ? "What happened, and what did you expect?" : kind === "idea" ? "What would you like to see?" : "Your message"}
              </span>
              <textarea
                required
                maxLength={MAX_MESSAGE}
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${inputClass} mt-1.5 resize-y`}
              />
              <span className="block text-right text-xs text-gray-400 mt-1 tabular-nums">{message.length} / {MAX_MESSAGE}</span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email <span className="font-normal text-gray-400">(optional, only if you’d like a reply)</span></span>
              <input
                type="email"
                maxLength={320}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={includeDevice} onChange={(e) => setIncludeDevice(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
              <span>Include app version and device type <span className="text-gray-400">(helps us fix bugs)</span></span>
            </label>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="w-full py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold text-white transition-colors"
            >
              {sending ? "Sending…" : "Send Feedback"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
