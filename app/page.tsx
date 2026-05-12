"use client";

import SetSearch from "./components/SetSearch";
import PokemonMasterSetCard from "./components/PokemonMasterSetCard";
import { useStore } from "@/lib/store";

export default function Home() {
  const { trackedPokemon } = useStore();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Master Set Tracker</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Search a Pokémon to add its master set — every card ever printed with that Pokémon.
        </p>
        <SetSearch />
      </div>

      {trackedPokemon.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 dark:text-gray-600">
          <span className="text-6xl mb-4">🃏</span>
          <p className="text-lg font-medium mb-1">No master sets yet</p>
          <p className="text-sm">Search a Pokémon above to start tracking.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Tracking {trackedPokemon.length} master set{trackedPokemon.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trackedPokemon.map((tracked) => (
              <PokemonMasterSetCard key={tracked.name} tracked={tracked} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
