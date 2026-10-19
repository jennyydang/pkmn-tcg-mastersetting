"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ErrorText, Spinner, cardClass } from "./ui";

interface Stats {
  users_total: number;
  users_new_7d: number;
  users_active_7d: number;
  users_active_30d: number;
  tracked_sets: number;
  owned_cards: number;
  collection_cards: number;
  feedback_open: number;
  feedback_in_progress: number;
}

export default function OverviewTab({ onOpenFeedback }: { onOpenFeedback: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data, error }) => {
      if (error) setError(error.message);
      else setStats(data as Stats);
    });
  }, []);

  if (error) return <ErrorText>Couldn’t load stats: {error}</ErrorText>;
  if (!stats) return <Spinner />;

  const tiles: { label: string; value: number; hint?: string }[] = [
    { label: "Users", value: stats.users_total, hint: `+${stats.users_new_7d} this week` },
    { label: "Active (7 days)", value: stats.users_active_7d, hint: `${stats.users_active_30d} in 30 days` },
    { label: "Master sets tracked", value: stats.tracked_sets },
    { label: "Cards marked owned", value: stats.owned_cards },
    { label: "My Collection cards", value: stats.collection_cards },
  ];

  const openIssues = stats.feedback_open + stats.feedback_in_progress;

  return (
    <div className="space-y-4">
      <button
        onClick={onOpenFeedback}
        className={`${cardClass} w-full p-5 text-left flex items-center justify-between gap-4 hover:border-blue-400 transition-colors`}
      >
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Feedback to handle</p>
          <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{openIssues}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{stats.feedback_open} new · {stats.feedback_in_progress} in progress</p>
        </div>
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">Open inbox →</span>
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${cardClass} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t.label}</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{t.value.toLocaleString()}</p>
            {t.hint && <p className="text-xs text-gray-500 dark:text-gray-400">{t.hint}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">“Active” means signed in during that period.</p>
    </div>
  );
}
