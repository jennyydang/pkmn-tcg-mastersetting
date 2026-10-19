"use client";

import { useAuth } from "@/lib/auth";
import { useOnline } from "@/lib/online";
import { usePendingCount } from "@/lib/syncQueue";
import { CloudOffIcon, SyncIcon } from "./Icons";

// Shows when the device is offline (data comes from saved copies, changes queue)
// and while queued changes are syncing after the connection returns.
export default function OfflineBanner() {
  const { user } = useAuth();
  const online = useOnline();
  const pending = usePendingCount(user?.id);
  if (online && pending === 0) return null;

  const changes = `${pending} ${pending === 1 ? "change" : "changes"}`;
  return (
    <div role="status" className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 fade-in">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        online
          ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
          : "border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
      }`}>
        {online ? <SyncIcon className="w-5 h-5 shrink-0 animate-spin [animation-duration:2s]" /> : <CloudOffIcon className="w-5 h-5 shrink-0" />}
        <p className="flex-1">
          {online
            ? `Syncing ${changes}…`
            : <>You’re offline. Showing saved cards and prices{pending > 0 ? `; ${changes} will sync when you reconnect.` : "; changes will sync when you reconnect."}</>}
        </p>
      </div>
    </div>
  );
}
