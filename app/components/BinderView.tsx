"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { VARIANT_LABELS } from "@/lib/variants";
import { tapFeedback } from "@/lib/haptics";
import { CardTile } from "./CardGrid";
import { ChevronRightIcon } from "./Icons";

const POCKETS = 9;

interface Props {
  tiles: CardTile[];
  onToggle: (key: string) => void;
}

// Cards in order on 9-pocket binder pages. Phones show one page and swipe
// sideways; from md up it's an open binder with two pages side by side.
// Owned cards show their scan; missing ones are empty pockets with the number.
export default function BinderView({ tiles, onToggle }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [first, setFirst] = useState(0);
  const [perView, setPerView] = useState(1);

  const pages: CardTile[][] = [];
  for (let i = 0; i < tiles.length; i += POCKETS) pages.push(tiles.slice(i, i + POCKETS));
  // Spreads need an even page count so the last right-hand page isn't missing.
  const pageCount = perView === 2 && pages.length % 2 ? pages.length + 1 : pages.length;

  // Which page is in view, and whether we're showing one page or a spread.
  function measure() {
    const el = scroller.current;
    const page = el?.firstElementChild as HTMLElement | null;
    if (!el || !page) return;
    setPerView(Math.round(el.clientWidth / page.clientWidth));
    setFirst(Math.round(el.scrollLeft / page.clientWidth));
  }
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function turn(direction: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  const last = Math.min(first + perView, pageCount);
  const pageLabel = perView === 2 ? `Pages ${first + 1}–${last}` : `Page ${first + 1}`;

  return (
    <div className="fade-in">
      <div className="relative">
        <div
          ref={scroller}
          onScroll={measure}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="binder"
          aria-label={`Binder, ${pageCount} pages`}
        >
          {Array.from({ length: pageCount }, (_, p) => (
            <section
              key={p}
              aria-label={`Page ${p + 1}`}
              className={`shrink-0 w-full md:w-1/2 snap-start ${p % 2 ? "md:snap-align-none" : ""} p-3 sm:p-4 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 ${
                p % 2 ? "md:border-l-0 md:rounded-r-2xl md:rounded-l-none" : "md:rounded-l-2xl md:rounded-r-none"
              } rounded-2xl`}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: POCKETS }, (_, i) => {
                  const tile = pages[p]?.[i];
                  return tile ? <Pocket key={tile.key} tile={tile} onToggle={onToggle} /> : <EmptyPocket key={i} />;
                })}
              </div>
              <p className="mt-2 text-center text-[11px] text-gray-400">{p + 1}</p>
            </section>
          ))}
        </div>

        {/* Binder rings down the middle of a spread. */}
        <div className="hidden md:flex absolute inset-y-6 left-1/2 -translate-x-1/2 flex-col justify-around pointer-events-none" aria-hidden="true">
          {[0, 1, 2].map((r) => (
            <span key={r} className="block w-5 h-9 rounded-full border-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 shadow-inner" />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <button onClick={() => turn(-1)} disabled={first === 0} aria-label="Previous page"
          className="w-11 h-11 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-30 transition-opacity">
          <ChevronRightIcon className="w-5 h-5 rotate-180" />
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums" aria-live="polite">
          {pageLabel} of {pageCount}
          <span className="md:hidden text-xs text-gray-400"> · swipe to turn</span>
        </p>
        <button onClick={() => turn(1)} disabled={last >= pageCount} aria-label="Next page"
          className="w-11 h-11 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-30 transition-opacity">
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Pocket({ tile, onToggle }: { tile: CardTile; onToggle: (key: string) => void }) {
  const { card, variant, owned } = tile;
  const [justAdded, setJustAdded] = useState(false);
  const label = variant ? VARIANT_LABELS[variant].long : null;

  return (
    <button
      onClick={() => { tapFeedback(); setJustAdded(!owned); onToggle(tile.key); }}
      onAnimationEnd={() => setJustAdded(false)}
      aria-pressed={owned}
      aria-label={`${card.name}${label ? ` ${label}` : ""} #${card.number} — ${owned ? "Owned, tap to unmark" : "Not owned, tap to mark as owned"}`}
      className={`relative aspect-[146/204] rounded-md overflow-hidden transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        owned
          ? "shadow-md"
          : "border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-900/40"
      } ${justAdded ? "pop-in" : ""}`}
    >
      {owned ? (
        <>
          <Image src={card.images.small} alt="" width={146} height={204} className="w-full h-full object-cover" unoptimized />
          {/* Sleeve sheen */}
          <span className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent pointer-events-none" aria-hidden="true" />
        </>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center p-1 text-center">
          <span className="text-sm sm:text-base font-bold text-gray-400 dark:text-gray-500 tabular-nums">#{card.number}</span>
          <span className="text-[10px] leading-tight text-gray-400 dark:text-gray-500 line-clamp-2">{card.name}</span>
        </span>
      )}
      {label && (
        <span className={`absolute bottom-1 inset-x-1 rounded px-0.5 text-center text-[9px] font-bold leading-tight ${owned ? "text-white bg-black/60" : "text-gray-500 dark:text-gray-400 bg-gray-200/80 dark:bg-gray-700/80"}`}>
          {label}
        </span>
      )}
    </button>
  );
}

function EmptyPocket() {
  return <div className="aspect-[146/204] rounded-md border border-gray-200/70 dark:border-gray-700/70" aria-hidden="true" />;
}
