"use client";

import { useEffect, useRef, useState } from "react";
import { ownedCardIds } from "@/lib/variants";
import { masterSetHref } from "@/lib/links";
import { tiltHandlers } from "@/lib/motion";
import Link from "next/link";
import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TrackedMasterSet } from "@/lib/types";
import { useStore } from "@/lib/store";
import { tapFeedback } from "@/lib/haptics";
import { CardsIcon, CheckIcon, TrashIcon, TrophyIcon } from "./Icons";

// Swipe a tile left on a touch screen to reveal Remove on its right.
const ACTION_WIDTH = 96;
// Only one tile stays swiped open at a time.
const SWIPE_OPEN_EVENT = "pocketi-swipe-open";

interface Props {
  tracked: TrackedMasterSet;
  isEditing: boolean;
  /** Position in the grid, for the cascading entrance. */
  index?: number;
}

export default function MasterSetCard({ tracked, isEditing, index = 0 }: Props) {
  const { removeItem } = useStore();
  const { id, label, image, totalCards, ownedCards, type, subtitle } = tracked;
  // Count cards, not versions: a card with several owned versions counts once.
  const owned = ownedCardIds(ownedCards).size;
  const pct = totalCards > 0 ? Math.round((owned / totalCards) * 100) : 0;
  // Custom sets: you mark them complete; until then the total isn't settled.
  const ongoingCustom = type === "custom" && tracked.status !== "complete";
  const complete = type === "custom" ? tracked.status === "complete" : totalCards > 0 && owned >= totalCards;

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Swipe state: offset is how far the tile has slid left (≤ 0).
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touch = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  const justSwiped = useRef(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const open = offset < 0 && !swiping;

  // Close when another tile opens, or on a touch anywhere else.
  useEffect(() => {
    if (!open) return;
    const onOtherOpen = (e: Event) => { if ((e as CustomEvent).detail !== id) setOffset(0); };
    const onTouchOutside = (e: TouchEvent) => { if (!rowRef.current?.contains(e.target as Node)) setOffset(0); };
    window.addEventListener(SWIPE_OPEN_EVENT, onOtherOpen);
    document.addEventListener("touchstart", onTouchOutside, { passive: true });
    return () => {
      window.removeEventListener(SWIPE_OPEN_EVENT, onOtherOpen);
      document.removeEventListener("touchstart", onTouchOutside);
    };
  }, [open, id]);

  const swipeHandlers = isEditing ? {} : {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      touch.current = { x: t.clientX, y: t.clientY, base: offset, axis: null };
      justSwiped.current = false;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = touch.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (s.axis !== "x") return;
      justSwiped.current = true;
      setSwiping(true);
      // Follows the finger, with resistance past the button and to the right.
      const raw = s.base + dx;
      setOffset(raw > 0 ? raw / 4 : raw < -ACTION_WIDTH ? -ACTION_WIDTH + (raw + ACTION_WIDTH) / 4 : raw);
    },
    onTouchEnd: () => {
      const s = touch.current;
      touch.current = null;
      if (s?.axis !== "x") return;
      setSwiping(false);
      setOffset((o) => {
        const opening = o < -ACTION_WIDTH / 2;
        if (opening && s.base === 0) {
          tapFeedback();
          window.dispatchEvent(new CustomEvent(SWIPE_OPEN_EVENT, { detail: id }));
        }
        return opening ? -ACTION_WIDTH : 0;
      });
    },
  };
  // A swipe (or tapping an open tile) shouldn't follow the link.
  const onLinkClick = (e: React.MouseEvent) => {
    if (justSwiped.current || offset < 0) {
      e.preventDefault();
      justSwiped.current = false;
      setOffset(0);
    }
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.4 : 1,
    "--i": index,
  } as React.CSSProperties;

  // Editing (via the Edit Sets button): dnd-kit drag listeners. Otherwise the
  // mouse tilt. Kept separate so neither overrides the other's pointer handlers.
  const interactionProps = isEditing ? { ...attributes, ...listeners } : tiltHandlers;

  const href = masterSetHref(tracked);

  const cardContent = (
    <>
      <div className="flex items-center gap-4 mb-4">
        {image ? (
          <Image
            src={image}
            alt={label}
            width={type === "set" ? 80 : 56}
            height={type === "set" ? 32 : 78}
            className="object-contain rounded shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-400"><CardsIcon className="w-7 h-7" /></div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{label}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
            {type === "pokemon" ? "Master Set" : type === "artist" ? "Artist Collection" : type === "custom" ? "Custom Set" : (subtitle ?? "Set")}
            {/* Custom sets carry the status you set (ongoing unless marked complete). */}
            {type === "custom" && (
              tracked.status === "complete" ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px] font-semibold">
                  <CheckIcon className="w-3 h-3" /> Complete
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold">Ongoing</span>
              )
            )}
          </p>
        </div>
      </div>

      {totalCards > 0 || type === "custom" ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1.5">
            <span className={ongoingCustom ? "text-gray-500 dark:text-gray-400" : ""}>{owned} / {ongoingCustom ? "?" : totalCards} cards</span>
            {!ongoingCustom && <span className={complete ? "text-green-600 dark:text-green-400 font-semibold" : ""}>{pct}%</span>}
          </div>
          <div className={`w-full rounded-full h-1.5 overflow-hidden ${ongoingCustom ? "bg-gray-100/70 dark:bg-gray-700/60" : "bg-gray-100 dark:bg-gray-700"}`}>
            {!ongoingCustom && (
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${complete ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
          {complete && (
            <p className="mt-2 flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400 font-semibold">
              <TrophyIcon className="w-4 h-4" /> {type === "custom" ? "Custom Set Complete!" : "Master Set Complete!"}
            </p>
          )}
        </>
      ) : (
        owned > 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">{owned} cards owned</p>
        ) : null
      )}
    </>
  );

  return (
    <>
      <div
        ref={(node) => { setNodeRef(node); rowRef.current = node; }}
        style={style}
        {...interactionProps}
        {...swipeHandlers}
        onContextMenu={(e) => e.preventDefault()}
        className={`stagger-in relative rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm select-none overflow-hidden ${isEditing ? "touch-none bg-white dark:bg-gray-800" : "tile no-press swipe-row touch-pan-y bg-white dark:bg-gray-800"}`}
      >
        {!isEditing && (
          <button
            onClick={() => { setOffset(0); setShowDeleteModal(true); }}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            className="absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 bg-red-600 text-white text-xs font-semibold"
            // Hidden at rest so its red doesn't show through the rounded corners.
            style={{ width: ACTION_WIDTH, visibility: offset < 0 ? "visible" : "hidden" }}
          >
            <TrashIcon className="w-6 h-6" />
            Remove
          </button>
        )}
        {isEditing && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
            aria-label={`Remove ${label}`}
            className="absolute top-2 right-2 z-20 w-7 h-7 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-full flex items-center justify-center shadow-md hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {isEditing ? (
          <div className="p-5">{cardContent}</div>
        ) : (
          <Link
            href={href}
            onClick={onLinkClick}
            draggable={false}
            className="relative block p-5 bg-white dark:bg-gray-800"
            style={{
              transform: offset ? `translateX(${offset}px)` : undefined,
              transition: swiping ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            {cardContent}
          </Link>
        )}
      </div>

      {showDeleteModal && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
        >
          <div className="dialog-in bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Remove {label}?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your progress will be lost. This cannot be undone.</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { removeItem(id); setShowDeleteModal(false); }}
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
