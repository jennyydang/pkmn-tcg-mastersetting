"use client";

import Link from "next/link";
import Image from "next/image";
import { TrackedSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { XIcon } from "./Icons";

interface Props {
  tracked: TrackedSet;
}

export default function SetCard({ tracked }: Props) {
  const { removeSet } = useStore();
  const { set, ownedCards } = tracked;
  const total = set.printedTotal ?? set.total;
  const owned = ownedCards.length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const complete = owned >= total;

  return (
    <div className="relative group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <button
        onClick={(e) => { e.preventDefault(); removeSet(set.id); }}
        aria-label="Remove set"
        className="absolute top-2 right-2 z-10 p-1 rounded-full bg-gray-100 dark:bg-gray-700 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 dark:hover:text-red-400 transition-all"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>

      <Link href={`/sets/${set.id}`} className="block p-5">
        {set.images?.logo && (
          <div className="flex justify-center mb-4 h-14">
            <Image
              src={set.images.logo}
              alt={set.name}
              width={160}
              height={56}
              className="object-contain max-h-14"
              unoptimized
            />
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-0.5">{set.name}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{set.series}</p>

        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
          <span>{owned} / {total} cards</span>
          <span className={complete ? "text-green-600 dark:text-green-400 font-semibold" : ""}>{pct}%</span>
        </div>

        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {complete && (
          <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold text-center">Master Set Complete!</p>
        )}
      </Link>
    </div>
  );
}
