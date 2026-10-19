"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getCardsByIds } from "@/lib/api";
import { useCardView, useIncludeVariants } from "@/lib/prefs";
import { CardVariant, PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedKey, variantPrice } from "@/lib/variants";
import CardGrid, { CardTile } from "./CardGrid";
import { staggerStyle } from "@/lib/motion";
import BinderView from "./BinderView";
import QuickAdd from "./QuickAdd";

interface Props {
  cards: PokemonCard[];
  ownedKeys: string[];
  onToggle: (key: string) => void;
  /** Show each card's set in the What's left list (Pokémon and artist pages span sets). */
  showSetNames?: boolean;
  /** Offer Quick add by card number (set pages only; numbers repeat across sets). */
  quickAdd?: boolean;
}

type Filter = "all" | "owned" | "missing";

interface MissingEntry {
  card: PokemonCard;
  /** null: any version will do (variants off), priced at its cheapest version. */
  variant: CardVariant | null;
}

// Filters, What's left and the card grid for a set, Pokémon or artist page.
export default function MasterSetCards({ cards, ownedKeys, onToggle, showSetNames = false, quickAdd = false }: Props) {
  const [includeVariants] = useIncludeVariants();
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useCardView();
  const owned = useMemo(() => new Set(ownedKeys), [ownedKeys]);

  // With variants on, every printed version is its own tile (labelled when a card
  // has more than one). Off, each card is one tile that counts as owned if any
  // version is, and tapping it marks the base version.
  const { tiles, missing } = useMemo(() => {
    const tiles: CardTile[] = [];
    const missing: MissingEntry[] = [];
    for (const card of cards) {
      const versions = cardVariants(card);
      if (includeVariants) {
        for (const v of versions) {
          const key = ownedKey(card, v);
          const has = owned.has(key);
          tiles.push({ card, key, variant: versions.length > 1 ? v : null, owned: has });
          if (!has) missing.push({ card, variant: v });
        }
      } else {
        const has = versions.some((v) => owned.has(ownedKey(card, v)));
        tiles.push({ card, key: ownedKey(card, versions[0]), variant: null, owned: has });
        if (!has) missing.push({ card, variant: null });
      }
    }
    return { tiles, missing };
  }, [cards, owned, includeVariants]);

  const ownedCount = tiles.filter((t) => t.owned).length;
  const filtered = tiles.filter((t) => (filter === "owned" ? t.owned : filter === "missing" ? !t.owned : true));

  return (
    <>
      {quickAdd && <QuickAdd cards={cards} owned={owned} onToggle={onToggle} />}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* A binder shows every pocket in order, so filters only apply to the grid. */}
        {view === "grid" && <div className="flex flex-wrap gap-2" role="group" aria-label="Filter cards">{(["all", "owned", "missing"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-medium transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${filter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-400"}`}>
            {f === "all" ? `All (${tiles.length})` : f === "owned" ? `Owned (${ownedCount})` : `Missing (${tiles.length - ownedCount})`}
          </button>
        ))}</div>}
        {view === "binder" && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{ownedCount} of {tiles.length} pockets filled</p>
        )}
        <div className="ml-auto flex rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5" role="radiogroup" aria-label="View">
          {(["grid", "binder"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
              className={`px-4 min-h-[40px] rounded-full text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                view === v ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900" : "text-gray-600 dark:text-gray-300"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {missing.length > 0 && (
        <WhatsLeft entries={missing} includeVariants={includeVariants} showSetNames={showSetNames} />
      )}

      {view === "binder" ? (
        <BinderView tiles={tiles} onToggle={onToggle} />
      ) : filtered.length > 0 ? (
        <CardGrid tiles={filtered} onToggle={onToggle} />
      ) : (
        <div className="py-16 text-center text-gray-400 dark:text-gray-600"><p className="text-lg">No cards to show</p></div>
      )}
    </>
  );
}

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const COLLAPSED_ROWS = 10;

function WhatsLeft({ entries, includeVariants, showSetNames }: { entries: MissingEntry[]; includeVariants: boolean; showSetNames: boolean }) {
  const [open, setOpen]       = useState(false);
  const [opened, setOpened]   = useState(false);
  const [priced, setPriced]   = useState<Map<string, PokemonCard>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const unpricedIds = [...new Set(entries.map((e) => e.card.id))].filter((id) => !priced.has(id));

  async function loadPrices() {
    if (unpricedIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await getCardsByIds(unpricedIds);
      setPriced((prev) => {
        const next = new Map(prev);
        for (const c of fetched) next.set(c.id, c);
        return next;
      });
    } catch {
      setError("Couldn't load prices. Try again in a minute.");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) setOpened(true);
    if (next) loadPrices();
  }

  // Price each missing entry; with variants off, the cheapest version completes the slot.
  const rows = entries
    .map((e) => {
      const full = priced.get(e.card.id);
      let price: number | undefined;
      if (full) {
        const options = e.variant ? [variantPrice(full, e.variant)] : cardVariants(full).map((v) => variantPrice(full, v));
        const known = options.filter((p): p is number => p != null);
        price = known.length ? Math.min(...known) : undefined;
      }
      return { ...e, price };
    })
    .sort((a, b) => (b.price ?? -1) - (a.price ?? -1));

  const total = rows.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const unknown = rows.filter((r) => r.price == null).length;
  const pricedAny = rows.some((r) => r.price != null);
  const visible = showAll ? rows : rows.slice(0, COLLAPSED_ROWS);
  const noun = includeVariants ? (rows.length === 1 ? "version" : "versions") : (rows.length === 1 ? "card" : "cards");

  return (
    <section className="mb-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 min-h-[44px] text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <div>
          <h2 className="font-bold text-gray-900 dark:text-gray-100">What&apos;s left</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {rows.length} {noun} to go
            {open && pricedAny && <> · about <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(total)}</span></>}
            {!open && " · tap to see the cost"}
          </p>
        </div>
        <svg className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Kept mounted after the first open so closing animates too; inert while closed. */}
      <div className="expand-panel" data-open={open}>
        <div inert={!open}>
          {opened && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-3">
              {loading && (
                <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  Pricing {unpricedIds.length} {unpricedIds.length === 1 ? "card" : "cards"}…
                </p>
              )}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">
                  {error}{" "}
                  <button onClick={loadPrices} className="font-medium underline">Retry</button>
                </p>
              )}
              {!loading && unpricedIds.length > 0 && priced.size > 0 && (
                <button onClick={loadPrices} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  Price {unpricedIds.length} newly missing {unpricedIds.length === 1 ? "card" : "cards"}
                </button>
              )}

              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {visible.map(({ card, variant, price }, i) => (
                  <li key={`${card.id}|${variant ?? "any"}`} style={staggerStyle(i)} className="stagger-in flex items-center gap-3 py-2">
                    <Image src={card.images.small} alt="" width={32} height={45} className="rounded shrink-0" unoptimized />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        #{card.number}
                        {showSetNames && ` · ${card.set.name}`}
                        {variant && cardVariants(card).length > 1 && ` · ${VARIANT_LABELS[variant].long}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">
                      {price != null ? fmt(price) : priced.has(card.id) ? "No price" : "—"}
                    </span>
                  </li>
                ))}
              </ul>

              {rows.length > COLLAPSED_ROWS && (
                <button onClick={() => setShowAll(!showAll)} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                  {showAll ? "Show fewer" : `Show all ${rows.length}`}
                </button>
              )}

              {!loading && pricedAny && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  TCGplayer market prices{unknown > 0 && `; ${unknown} without a price aren't in the total`}
                  {!includeVariants && ". Each card is priced at its cheapest version"}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
