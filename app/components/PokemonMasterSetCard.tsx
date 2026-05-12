"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TrackedPokemon } from "@/lib/types";
import { useStore } from "@/lib/store";

interface Props {
  tracked: TrackedPokemon;
  isEditing: boolean;
  onActivateEdit: () => void;
}

export default function PokemonMasterSetCard({ tracked, isEditing, onActivateEdit }: Props) {
  const { removePokemon } = useStore();
  const { name, image, totalCards, ownedCards } = tracked;
  const owned = ownedCards.length;
  const pct = totalCards > 0 ? Math.round((owned / totalCards) * 100) : 0;
  const complete = totalCards > 0 && owned >= totalCards;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Long-press to activate edit mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMove = useRef(false);

  function onPointerDown() {
    if (isEditing) return;
    didMove.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!didMove.current) onActivateEdit();
    }, 500);
  }
  function onPointerMove() {
    didMove.current = true;
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }
  function onPointerUp() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  // dnd-kit sortable
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: name,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  const cardContent = (
    <>
      <div className="flex items-center gap-4 mb-4">
        <Image
          src={image}
          alt={name}
          width={56}
          height={78}
          className="object-contain rounded shrink-0"
          unoptimized
        />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">{name}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Master Set</p>
        </div>
      </div>

      {totalCards > 0 ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
            <span>{owned} / {totalCards} cards</span>
            <span className={complete ? "text-green-600 dark:text-green-400 font-semibold" : ""}>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {complete && (
            <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-semibold text-center">
              Master Set Complete! 🏆
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {owned > 0 ? `${owned} cards owned` : "Click to view cards"}
        </p>
      )}
    </>
  );

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...(isEditing ? { ...attributes, ...listeners } : {})}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow select-none touch-none ${isEditing ? "jiggle" : ""}`}
      >
        {/* X delete button — visible only in edit mode */}
        {isEditing && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
            aria-label={`Remove ${name}`}
            className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Card body — link only when not editing */}
        {isEditing ? (
          <div className="block p-5">{cardContent}</div>
        ) : (
          <Link href={`/pokemon/${encodeURIComponent(name)}`} className="block p-5">
            {cardContent}
          </Link>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                Remove {name} Master Set?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your progress will be lost. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { removePokemon(name); setShowDeleteModal(false); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
