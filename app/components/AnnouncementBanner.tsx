"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { XIcon } from "./Icons";

interface Announcement {
  id: string;
  message: string;
  level: "info" | "warning";
}

const DISMISSED_KEY = "pkmn-dismissed-announcements";

function dismissedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Newest active announcement posted from /admin, until this viewer dismisses it.
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("announcements")
      .select("id, message, level")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        // Before supabase/admin.sql is run the table doesn't exist; show nothing.
        if (cancelled || error || !data) return;
        const dismissed = dismissedIds();
        setAnnouncement((data as Announcement[]).find((a) => !dismissed.includes(a.id)) ?? null);
      });
    return () => { cancelled = true; };
  }, []);

  if (!announcement) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedIds(), announcement!.id].slice(-50)));
    } catch {}
    setAnnouncement(null);
  }

  const warning = announcement.level === "warning";
  return (
    <div role="status" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        warning
          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
          : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
      }`}>
        <span aria-hidden="true">{warning ? "⚠️" : "📣"}</span>
        <p className="flex-1 whitespace-pre-line">{announcement.message}</p>
        <button onClick={dismiss} aria-label="Dismiss announcement" className="p-1 -m-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
