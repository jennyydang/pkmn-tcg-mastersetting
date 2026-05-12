"use client";

import SetSearch from "./components/SetSearch";
import SetCard from "./components/SetCard";
import { useStore } from "@/lib/store";

export default function Home() {
  const { trackedSets } = useStore();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Master Set Tracker</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Search for a Pokémon TCG set to start tracking your collection progress.</p>
        <SetSearch />
      </div>

      {trackedSets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 dark:text-gray-600">
          <span className="text-6xl mb-4">🃏</span>
          <p className="text-lg font-medium mb-1">No sets tracked yet</p>
          <p className="text-sm">Search above to add a Pokémon TCG set and start tracking.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Tracking {trackedSets.length} set{trackedSets.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trackedSets.map((tracked) => (
              <SetCard key={tracked.set.id} tracked={tracked} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
