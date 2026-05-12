"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import SetSearch from "./components/SetSearch";
import PokemonMasterSetCard from "./components/PokemonMasterSetCard";
import { useStore } from "@/lib/store";

export default function Home() {
  const { trackedPokemon, reorderPokemon } = useStore();
  const [isEditing, setIsEditing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderPokemon(active.id as string, over.id as string);
    }
  }

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Tracking {trackedPokemon.length} master set{trackedPokemon.length !== 1 ? "s" : ""}
            </h2>
            <button
              onClick={() => setIsEditing((v) => !v)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                isEditing
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
              }`}
            >
              {isEditing ? "Done" : "Rearrange"}
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trackedPokemon.map((p) => p.name)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trackedPokemon.map((tracked) => (
                  <PokemonMasterSetCard
                    key={tracked.name}
                    tracked={tracked}
                    isEditing={isEditing}
                    onActivateEdit={() => setIsEditing(true)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
