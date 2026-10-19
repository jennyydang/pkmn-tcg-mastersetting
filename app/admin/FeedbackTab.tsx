"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { APP_NAME } from "@/lib/appInfo";
import { ErrorText, Spinner, cardClass, dangerButton, inputClass, primaryButton, secondaryButton, timeAgo } from "./ui";

type Status = "open" | "in_progress" | "resolved" | "wont_fix";

interface Feedback {
  id: string;
  created_at: string;
  kind: "bug" | "idea" | "other";
  message: string;
  contact_email: string | null;
  page: string | null;
  app_info: string | null;
  status: Status;
  admin_note: string | null;
  resolved_at: string | null;
}

const STATUSES: { value: Status; label: string }[] = [
  { value: "open",        label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved",    label: "Resolved" },
  { value: "wont_fix",    label: "Won’t fix" },
];

const KIND_BADGE: Record<Feedback["kind"], string> = {
  bug:   "🐞 Bug",
  idea:  "💡 Idea",
  other: "💬 Other",
};

export default function FeedbackTab() {
  const [status, setStatus]   = useState<Status>("open");
  const [kind, setKind]       = useState<"all" | Feedback["kind"]>("all");
  const [items, setItems]     = useState<Feedback[] | null>(null);
  const [counts, setCounts]   = useState<Partial<Record<Status, number>>>({});
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    let query = supabase.from("feedback").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100);
    if (kind !== "all") query = query.eq("kind", kind);
    const [list, ...countResults] = await Promise.all([
      query,
      ...STATUSES.map((s) => supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", s.value)),
    ]);
    if (list.error) { setError(list.error.message); return; }
    setError(null);
    setItems(list.data as Feedback[]);
    setCounts(Object.fromEntries(STATUSES.map((s, i) => [s.value, countResults[i].count ?? 0])));
  }, [status, kind]);

  useEffect(() => {
    // Async fetch: state is set after it resolves, not synchronously here.
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button key={s.value} onClick={() => { setStatus(s.value); setItems(null); }}
            aria-pressed={status === s.value}
            className={`px-3 py-2 min-h-[40px] rounded-full text-sm font-medium transition-colors ${status === s.value ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`}>
            {s.label}{counts[s.value] != null && ` (${counts[s.value]})`}
          </button>
        ))}
        <select value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setItems(null); }}
          aria-label="Type" className={`${inputClass} w-auto ml-auto`}>
          <option value="all">All types</option>
          <option value="bug">Bugs</option>
          <option value="idea">Ideas</option>
          <option value="other">Other</option>
        </select>
      </div>

      {error && <ErrorText>Couldn’t load feedback: {error}</ErrorText>}
      {!items && !error && <Spinner />}
      {items?.length === 0 && <p className="py-12 text-center text-gray-400">Nothing here 🎉</p>}
      {items?.map((f) => <FeedbackItem key={f.id} item={f} onChanged={load} />)}
    </div>
  );
}

function FeedbackItem({ item, onChanged }: { item: Feedback; onChanged: () => void }) {
  const [note, setNote]       = useState(item.admin_note ?? "");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function update(changes: Partial<Feedback>) {
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("feedback")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", item.id);
    setSaving(false);
    if (error) setError(error.message);
    else onChanged();
  }

  function setStatus(status: Status) {
    const done = status === "resolved" || status === "wont_fix";
    update({ status, resolved_at: done ? new Date().toISOString() : null, admin_note: note.trim() || null });
  }

  async function remove() {
    setSaving(true);
    const { error } = await supabase.from("feedback").delete().eq("id", item.id);
    setSaving(false);
    if (error) setError(error.message);
    else onChanged();
  }

  const replyHref = item.contact_email
    ? `mailto:${item.contact_email}?subject=${encodeURIComponent(`Re: your ${APP_NAME} feedback`)}&body=${encodeURIComponent(`\n\n> ${item.message.split("\n").join("\n> ")}`)}`
    : null;

  return (
    <article className={`${cardClass} p-5 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-200">{KIND_BADGE[item.kind]}</span>
        <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>{timeAgo(item.created_at)}</time>
        {item.page && <span>· from {item.page}</span>}
        {item.resolved_at && <span>· closed {timeAgo(item.resolved_at)}</span>}
      </div>

      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{item.message}</p>

      {item.app_info && <p className="text-xs text-gray-400 break-all">{item.app_info}</p>}

      {replyHref ? (
        <a href={replyHref} className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">Reply to {item.contact_email}</a>
      ) : (
        <p className="text-xs text-gray-400">No email left, so this can’t be replied to.</p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Internal note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={5000}
          placeholder="e.g. Fixed in 1.1, duplicate of…" className={`${inputClass} mt-1 resize-y`} />
      </label>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="flex flex-wrap gap-2">
        {item.status !== "in_progress" && item.status !== "resolved" && (
          <button disabled={saving} onClick={() => setStatus("in_progress")} className={secondaryButton}>Start</button>
        )}
        {item.status !== "resolved" && (
          <button disabled={saving} onClick={() => setStatus("resolved")} className={primaryButton}>Resolve</button>
        )}
        {item.status !== "wont_fix" && item.status !== "resolved" && (
          <button disabled={saving} onClick={() => setStatus("wont_fix")} className={secondaryButton}>Won’t fix</button>
        )}
        {(item.status === "resolved" || item.status === "wont_fix") && (
          <button disabled={saving} onClick={() => setStatus("open")} className={secondaryButton}>Reopen</button>
        )}
        {note !== (item.admin_note ?? "") && (
          <button disabled={saving} onClick={() => update({ admin_note: note.trim() || null })} className={secondaryButton}>Save note</button>
        )}
        <span className="flex-1" />
        {confirmDelete ? (
          <>
            <button disabled={saving} onClick={() => setConfirmDelete(false)} className={secondaryButton}>Cancel</button>
            <button disabled={saving} onClick={remove} className={dangerButton}>Delete forever</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={dangerButton}>Delete</button>
        )}
      </div>
    </article>
  );
}
