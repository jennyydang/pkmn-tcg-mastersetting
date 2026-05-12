"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import SetSearch from "./components/SetSearch";
import MasterSetCard from "./components/PokemonMasterSetCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import AuthModal from "./components/AuthModal";

export default function Home() {
  const { trackedItems, reorderItems } = useStore();
  const { user, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Exit edit mode when the user clicks/taps outside the card grid
  useEffect(() => {
    if (!isEditing) return;
    function onPointerDown(e: PointerEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    }
    // Delay by one frame so the event that triggered edit mode doesn't immediately cancel it
    const tid = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => { clearTimeout(tid); document.removeEventListener("pointerdown", onPointerDown); };
  }, [isEditing]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderItems(active.id as string, over.id as string);
    }
  }

  if (authLoading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {!user && <AuthModal />}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">Master Set Tracker</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Search a Pokémon or a TCG set to start tracking every card.
        </p>
        <SetSearch />
      </div>

      {trackedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-400 dark:text-gray-600">
          <span className="text-6xl mb-4">🃏</span>
          <p className="text-lg font-medium mb-1">No master sets yet</p>
          <p className="text-sm">Search a Pokémon or set above to start tracking.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Tracking {trackedItems.length} master set{trackedItems.length !== 1 ? "s" : ""}
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
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Click on a card to view and track its cards.</p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={trackedItems.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trackedItems.map((tracked) => (
                  <MasterSetCard
                    key={tracked.id}
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
