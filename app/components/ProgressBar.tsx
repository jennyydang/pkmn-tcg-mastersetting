import type { SetStatus } from "@/lib/types";

interface Props {
  owned: number;
  total: number;
  /** Custom sets only (see below). */
  status?: SetStatus;
}

/**
 * Progress toward a set. Custom sets pass their status: while "ongoing" the
 * total isn't settled, so it reads "owned / ?" with a greyed-out bar; once
 * "complete" it reads "owned / total" in green.
 */
export default function ProgressBar({ owned, total, status }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const ongoing = status === "ongoing";
  const complete = status === "complete" || (!status && owned >= total && total > 0);

  return (
    <div className="flex items-center gap-3">
      <div className={`flex-1 rounded-full h-2.5 overflow-hidden ${ongoing ? "bg-gray-200/70 dark:bg-gray-700/60" : "bg-gray-200 dark:bg-gray-700"}`}>
        {!ongoing && (
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${complete ? "text-green-600 dark:text-green-400" : ongoing ? "text-gray-500 dark:text-gray-400" : "text-gray-700 dark:text-gray-200"}`}>
        {owned} / {ongoing ? "?" : total}
      </span>
      {!ongoing && (
        <span className={`text-sm font-bold tabular-nums shrink-0 ${complete ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
          {pct}%
        </span>
      )}
    </div>
  );
}
