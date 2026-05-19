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
import { useRouter } from "next/navigation";
import SetSearch from "./components/SetSearch";
import MasterSetCard from "./components/PokemonMasterSetCard";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import AuthModal from "./components/AuthModal";

export default function Home() {
  const { trackedItems, reorderItems, addItem } = useStore();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customName, setCustomName] = useState("");
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
      <div className="mb-10 flex flex-col md:items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:text-center">Master Set Tracker</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 md:text-center">
          Search a Pokémon, set, or artist to start tracking every card.
        </p>
        <div className="w-full md:max-w-2xl">
          <SetSearch />
        </div>
        <div className="flex items-center gap-3 mt-5 w-full md:max-w-2xl">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-sm text-gray-400 dark:text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <button
          onClick={() => { setCustomName(""); setShowCreateModal(true); }}
          className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Custom Set
        </button>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Create Custom Set</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Give your set a name, then add cards one by one.</p>
              <input
                autoFocus
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim()) {
                    const id = `custom_${Date.now()}`;
                    addItem({ type: "custom", id, label: customName.trim(), image: "", totalCards: 0, ownedCards: [], customCards: [], subtitle: "Custom set" });
                    setShowCreateModal(false);
                    router.push(`/custom/${id}`);
                  }
                }}
                placeholder="e.g. My Favourite Cards, Pikachu Collection…"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!customName.trim()}
                onClick={() => {
                  const id = `custom_${Date.now()}`;
                  addItem({ type: "custom", id, label: customName.trim(), image: "", totalCards: 0, ownedCards: [], customCards: [], subtitle: "Custom set" });
                  setShowCreateModal(false);
                  router.push(`/custom/${id}`);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
              >
                Create &amp; Add Cards
              </button>
            </div>
          </div>
        </div>
      )}

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
              {isEditing ? "Done" : "Edit Sets"}
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
