"use client";

import { normalizeNumber } from "@/lib/api";
import { CollectionSort } from "@/lib/prefs";
import { PokemonCard } from "@/lib/types";
import { SearchIcon, XIcon } from "./Icons";

// Sort and filter for the My Collection grid.

export interface CollectionFilter {
  query: string;
  set: string;
  rarity: string;
  language: "" | "en" | "ja";
}

export const NO_FILTER: CollectionFilter = { query: "", set: "", rarity: "", language: "" };

const SORT_LABELS: Record<CollectionSort, string> = {
  recent: "Recently added",
  name: "Name (A–Z)",
  "value-desc": "Value (high–low)",
  "value-asc": "Value (low–high)",
  set: "Set & number",
  release: "Newest release",
};

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every word must match the name, set, rarity or artist; numbers match the card number. */
function matchesQuery(card: PokemonCard, query: string) {
  const text = fold([card.name, card.localName, card.set.name, card.rarity, card.illustrator].filter(Boolean).join(" "));
  return query.trim().split(/\s+/).filter(Boolean).every((w) => {
    const number = /^#?([a-z]*\d+)(\/\S*)?$/i.exec(w);
    return number ? normalizeNumber(card.number) === normalizeNumber(number[1]) : text.includes(fold(w));
  });
}

/**
 * The cards to show, filtered and sorted. `cards` arrives oldest-added first;
 * `valueOf` is a card's value for your copies (lib/collectionValue.ts).
 */
export function applyCollectionView(cards: PokemonCard[], filter: CollectionFilter, sort: CollectionSort, valueOf: (card: PokemonCard) => number | undefined) {
  const shown = cards.filter((c) =>
    (!filter.query || matchesQuery(c, filter.query)) &&
    (!filter.set || c.set.id === filter.set) &&
    (!filter.rarity || c.rarity === filter.rarity) &&
    (!filter.language || (filter.language === "ja") === (c.set.language === "ja"))
  );
  const byNumber = (a: PokemonCard, b: PokemonCard) => a.number.localeCompare(b.number, undefined, { numeric: true });
  switch (sort) {
    case "recent": return shown.reverse();
    case "name": return shown.sort((a, b) => a.name.localeCompare(b.name) || byNumber(a, b));
    case "value-desc": return shown.sort((a, b) => (valueOf(b) ?? -1) - (valueOf(a) ?? -1));
    case "value-asc": return shown.sort((a, b) => (valueOf(a) ?? Infinity) - (valueOf(b) ?? Infinity));
    case "set": return shown.sort((a, b) => a.set.name.localeCompare(b.set.name) || byNumber(a, b));
    case "release": return shown.sort((a, b) => b.set.releaseDate.localeCompare(a.set.releaseDate) || byNumber(a, b));
  }
}

const selectClass =
  "appearance-none [field-sizing:content] pl-3 pr-8 min-h-[40px] max-w-[45vw] sm:max-w-[16rem] truncate rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-blue-400 transition-colors";
const activeClass = "!border-blue-500 !text-blue-700 dark:!text-blue-300 !bg-blue-50 dark:!bg-blue-900/30";

/** A pill-shaped native select (the phone's own picker) with a chevron. */
function Pick({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative shrink-0">
      <select {...props} className={`${selectClass} ${className}`}>{children}</select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

export default function CollectionFilters({ cards, filter, onFilter, sort, onSort, shownCount }: {
  cards: PokemonCard[];
  filter: CollectionFilter;
  onFilter: (f: CollectionFilter) => void;
  sort: CollectionSort;
  onSort: (s: CollectionSort) => void;
  shownCount: number;
}) {
  // Options come from the cards you own, with counts.
  const sets = new Map<string, { name: string; count: number }>();
  const rarities = new Map<string, number>();
  let japanese = 0;
  for (const c of cards) {
    const s = sets.get(c.set.id);
    sets.set(c.set.id, { name: c.set.name, count: (s?.count ?? 0) + 1 });
    if (c.rarity) rarities.set(c.rarity, (rarities.get(c.rarity) ?? 0) + 1);
    if (c.set.language === "ja") japanese++;
  }
  const filtered = filter.query || filter.set || filter.rarity || filter.language;
  const set = (patch: Partial<CollectionFilter>) => onFilter({ ...filter, ...patch });

  return (
    <div className="space-y-2 mb-4">
      <label className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 min-h-[40px] bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
        <SearchIcon className="w-4 h-4 text-gray-400 shrink-0" />
        <input type="search" value={filter.query} onChange={(e) => set({ query: e.target.value })}
          placeholder="Filter your cards: name, set, number, artist…" aria-label="Filter your cards"
          className="flex-1 min-w-0 appearance-none bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400" />
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none]">
        <Pick value={sort} onChange={(e) => onSort(e.target.value as CollectionSort)} aria-label="Sort">
          {(Object.keys(SORT_LABELS) as CollectionSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
        </Pick>
        <Pick value={filter.set} onChange={(e) => set({ set: e.target.value })} aria-label="Filter by set" className={filter.set ? activeClass : ""}>
          <option value="">All sets</option>
          {[...sets].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, s]) => <option key={id} value={id}>{s.name} ({s.count})</option>)}
        </Pick>
        <Pick value={filter.rarity} onChange={(e) => set({ rarity: e.target.value })} aria-label="Filter by rarity" className={filter.rarity ? activeClass : ""}>
          <option value="">All rarities</option>
          {[...rarities].sort((a, b) => a[0].localeCompare(b[0])).map(([r, n]) => <option key={r} value={r}>{r} ({n})</option>)}
        </Pick>
        {japanese > 0 && (
          <Pick value={filter.language} onChange={(e) => set({ language: e.target.value as CollectionFilter["language"] })} aria-label="Filter by language" className={filter.language ? activeClass : ""}>
            <option value="">All languages</option>
            <option value="en">English ({cards.length - japanese})</option>
            <option value="ja">Japanese ({japanese})</option>
          </Pick>
        )}
      </div>
      {filtered && (
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400" role="status">
          Showing {shownCount} of {cards.length}
          <button onClick={() => onFilter(NO_FILTER)} className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline">
            <XIcon className="w-3.5 h-3.5" /> Clear filters
          </button>
        </p>
      )}
    </div>
  );
}
