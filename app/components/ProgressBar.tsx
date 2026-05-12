interface Props {
  owned: number;
  total: number;
}

export default function ProgressBar({ owned, total }: Props) {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const complete = owned >= total;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-semibold tabular-nums shrink-0 ${complete ? "text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-200"}`}>
        {owned} / {total}
      </span>
      <span className={`text-sm font-bold tabular-nums shrink-0 ${complete ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
        {pct}%
      </span>
    </div>
  );
}
