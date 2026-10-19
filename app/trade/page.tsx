"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCardData } from "@/lib/cardData";
import { getCardsByIds } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { parseOwnedKey } from "@/lib/variants";
import { staggerStyle } from "@/lib/motion";
import { decodeTradeList, rowLabel, tradeRows } from "@/lib/trade";
import { APP_NAME } from "@/lib/appInfo";
import CardImage from "@/app/components/CardImage";
import { StarIcon, SwapIcon } from "@/app/components/Icons";

// A trade list someone shared (app/extras). The list is in the link itself, so
// anyone can open it without an account. Signed-in viewers see which cards are
// on their own want list.

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function TradePage() {
  return (
    <Suspense fallback={null}>
      <TradeList />
    </Suspense>
  );
}

function TradeList() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { isWanted } = useCardData();
  const entries = useMemo(() => decodeTradeList(params.get("l") ?? ""), [params]);
  const [cards, setCards] = useState<Map<string, PokemonCard> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ids = [...new Set(entries.map((e) => parseOwnedKey(e.key).cardId))];
    if (ids.length === 0) return;
    let cancelled = false;
    getCardsByIds(ids)
      .then((fetched) => { if (!cancelled) setCards(new Map(fetched.map((c) => [c.id, c]))); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [entries]);

  const rows = cards ? tradeRows(entries, cards) : [];
  // Cards you want come first.
  const wanted = (key: string) => !!user && isWanted(key);
  rows.sort((a, b) => Number(wanted(b.key)) - Number(wanted(a.key)) || (b.price ?? -1) - (a.price ?? -1));
  const total = rows.reduce((n, r) => n + r.count, 0);
  const value = rows.reduce((sum, r) => sum + (r.price ?? 0) * r.count, 0);
  const wantedCount = rows.filter((r) => wanted(r.key)).length;

  if (entries.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 py-24">This trade list link is empty or incomplete.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex items-start gap-4">
        <span className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <SwapIcon className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trade list</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {cards ? `${total} ${total === 1 ? "card" : "cards"} up for trade${value > 0 ? ` · about ${fmt(value)}` : ""}` : "Loading cards…"}
          </p>
          {wantedCount > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <StarIcon className="w-4 h-4" filled /> {wantedCount} {wantedCount === 1 ? "is" : "are"} on your wishlist
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">Couldn’t load the cards. Check your connection and refresh.</p>}
      {!cards && !error && (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      )}

      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {rows.map((row, i) => {
          const label = rowLabel(row);
          return (
            <li key={row.key} style={staggerStyle(i)} className="stagger-in">
              <div className={`relative rounded-lg ${wanted(row.key) ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-950" : ""}`}>
                <CardImage src={row.card.images.small} alt={row.card.name} width={146} height={204} className="w-full h-auto rounded-lg shadow-sm" />
                {row.count > 1 && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 min-w-[24px] h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow">×{row.count}</span>
                )}
                {wanted(row.key) && (
                  <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center shadow" title="On your wishlist">
                    <StarIcon className="w-3.5 h-3.5" filled />
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{row.card.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{label || `${row.card.set.name} #${row.card.number}`}</p>
              {row.price != null && <p className="text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">{fmt(row.price)}{row.graded ? " ungraded" : ""}</p>}
            </li>
          );
        })}
      </ul>

      {cards && (
        <p className="text-xs text-gray-400">TCGplayer market prices (Cardmarket, converted to dollars, for Japanese cards), estimated for each card’s condition; graded cards show the ungraded price. Check cards in person before swapping.</p>
      )}
      {!user && (
        <Link href="/" className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Track your own cards and make trade lists with {APP_NAME}
        </Link>
      )}
    </div>
  );
}
