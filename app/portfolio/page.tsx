"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getCardsByIds } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ChevronRightIcon } from "@/app/components/Icons";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Snapshot {
  recorded_at: string;
  value: number;
}

interface CardRow {
  id: string;
  name: string;
  number: string;
  price: number | null;
}

interface BreakdownRow {
  id: string;
  label: string;
  ownedCount: number;
  value: number;
  cards: CardRow[];
}

export default function PortfolioPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { trackedItems } = useStore();

  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (trackedItems.length === 0) { setLoading(false); return; }

    async function compute() {
      setLoading(true);
      try {
        const allIds = new Set<string>();
        for (const item of trackedItems) {
          for (const cardId of item.ownedCards) allIds.add(cardId);
        }

        const cards = await getCardsByIds([...allIds]);

        const cardInfoMap = new Map<string, { name: string; number: string }>();
        const priceMap = new Map<string, number>();
        for (const card of cards) {
          cardInfoMap.set(card.id, { name: card.name, number: card.number });
          const prices = card.tcgplayer?.prices;
          if (!prices) continue;
          const market = Object.values(prices).find((p) => p.market != null)?.market;
          if (market != null) priceMap.set(card.id, market);
        }

        let total = 0;
        for (const [, price] of priceMap) total += price;
        const count = priceMap.size;
        setTotalValue(total);
        setCardCount(count);

        const rows: BreakdownRow[] = trackedItems
          .map((item) => {
            let itemValue = 0;
            const itemCards: CardRow[] = item.ownedCards.map((cardId) => {
              const price = priceMap.get(cardId) ?? null;
              itemValue += price ?? 0;
              const info = cardInfoMap.get(cardId);
              return { id: cardId, name: info?.name ?? cardId, number: info?.number ?? "", price };
            });
            itemCards.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
            return { id: item.id, label: item.label, ownedCount: item.ownedCards.length, value: itemValue, cards: itemCards };
          })
          .filter((r) => r.ownedCount > 0)
          .sort((a, b) => b.value - a.value);
        setBreakdown(rows);

        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("portfolio_snapshots").upsert(
          { user_id: user!.id, value: Math.round(total * 100) / 100, card_count: count, recorded_at: today },
          { onConflict: "user_id,recorded_at" }
        );

        const { data } = await supabase
          .from("portfolio_snapshots")
          .select("recorded_at, value")
          .eq("user_id", user!.id)
          .order("recorded_at", { ascending: true })
          .limit(90);
        setSnapshots(
          (data ?? []).map((r: { recorded_at: string; value: string }) => ({
            recorded_at: r.recorded_at,
            value: Number(r.value),
          }))
        );
      } finally {
        setLoading(false);
      }
    }
    compute();
  }, [user, authLoading, trackedItems]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">My Portfolio</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Total Value
          </p>
          {loading ? (
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">${totalValue.toFixed(2)}</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Cards with Price Data
          </p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{cardCount}</p>
          )}
        </div>
      </div>

      {/* Line chart */}
      {snapshots.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-8 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Portfolio Value Over Time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={snapshots} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="recorded_at"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `$${v}`}
                width={60}
              />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}`, "Value"]}
                labelFormatter={(label: string) => label}
              />
              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-set breakdown accordion */}
      {breakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Breakdown by Set</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {breakdown.map((row) => {
              const isOpen = expanded.has(row.id);
              return (
                <div key={row.id}>
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleExpanded(row.id)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronRightIcon
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.label}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{row.ownedCount} cards owned</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0 ml-3">
                      ${row.value.toFixed(2)}
                    </p>
                  </button>

                  {/* Expanded card list */}
                  {isOpen && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                      {row.cards.map((card, i) => (
                        <div
                          key={card.id}
                          className={`flex items-center justify-between px-8 py-2 ${
                            i < row.cards.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-4">
                            {card.number && (
                              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">#{card.number}</span>
                            )}
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{card.name}</p>
                          </div>
                          <p className={`text-sm shrink-0 ${card.price != null ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}>
                            {card.price != null ? `$${card.price.toFixed(2)}` : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && breakdown.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-600 py-16">
          Start marking cards as owned to see your portfolio value.
        </p>
      )}
    </div>
  );
}
