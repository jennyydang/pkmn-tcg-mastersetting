"use client";

import { useStore } from "@/lib/store";
import { XIcon } from "./Icons";

// Shows when loading or saving to Supabase fails, so changes don't vanish silently.
export default function SyncErrorBanner() {
  const { syncError, clearSyncError } = useStore();
  if (!syncError) return null;

  return (
    <div role="alert" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        <p className="flex-1">{syncError}</p>
        <button onClick={clearSyncError} aria-label="Dismiss" className="p-1 -m-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
