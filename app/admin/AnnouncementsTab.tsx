"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useConfirm } from "@/lib/confirm";
import { MegaphoneIcon, WarningIcon } from "@/app/components/Icons";
import { ErrorText, Spinner, cardClass, dangerButton, inputClass, primaryButton, secondaryButton, timeAgo } from "./ui";

interface Announcement {
  id: string;
  created_at: string;
  message: string;
  level: "info" | "warning";
  active: boolean;
}

export default function AnnouncementsTab() {
  const [items, setItems]     = useState<Announcement[] | null>(null);
  const confirm = useConfirm();
  const [message, setMessage] = useState("");
  const [level, setLevel]     = useState<Announcement["level"]>("info");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) setError(error.message);
    else { setError(null); setItems(data as Announcement[]); }
  }, []);

  useEffect(() => {
    // Async fetch: state is set after it resolves, not synchronously here.
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  async function run(op: PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await op;
    setBusy(false);
    if (error) setError(error.message);
    else load();
    return !error;
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (await run(supabase.from("announcements").insert({ message: message.trim(), level }))) setMessage("");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={post} className={`${cardClass} p-5 space-y-3`}>
        <h2 className="font-bold text-gray-900 dark:text-gray-100">New announcement</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Shown as a banner at the top of the app for everyone, until they dismiss it or you turn it off.</p>
        <textarea required maxLength={500} rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Card prices are delayed today while our data provider recovers." className={`${inputClass} resize-y`} />
        <div className="flex flex-wrap items-center gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value as Announcement["level"])} aria-label="Style" className={`${inputClass} w-auto`}>
            <option value="info">Info (blue)</option>
            <option value="warning">Warning (amber)</option>
          </select>
          <button type="submit" disabled={busy || !message.trim()} className={primaryButton}>Post</button>
        </div>
      </form>

      {error && <ErrorText>{error}</ErrorText>}
      {!items && !error && <Spinner />}
      {items?.length === 0 && <p className="py-8 text-center text-gray-400">No announcements yet</p>}
      {items?.map((a) => (
        <div key={a.id} className={`${cardClass} p-4 space-y-2 ${a.active ? "" : "opacity-60"}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              {a.level === "warning" ? <><WarningIcon className="w-3.5 h-3.5 text-amber-500" />Warning</> : <><MegaphoneIcon className="w-3.5 h-3.5 text-blue-500" />Info</>}
            </span>
            <span>· {timeAgo(a.created_at)}</span>
            <span className={`px-2 py-0.5 rounded-full font-semibold ${a.active ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-gray-100 dark:bg-gray-700"}`}>
              {a.active ? "Showing" : "Off"}
            </span>
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">{a.message}</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => run(supabase.from("announcements").update({ active: !a.active }).eq("id", a.id))} className={secondaryButton}>
              {a.active ? "Turn off" : "Show again"}
            </button>
            <button disabled={busy} onClick={async () => {
              if (await confirm({ title: "Delete this announcement?", message: "It will be removed for everyone and can’t be restored.", confirmLabel: "Delete" })) {
                run(supabase.from("announcements").delete().eq("id", a.id));
              }
            }} className={dangerButton}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
