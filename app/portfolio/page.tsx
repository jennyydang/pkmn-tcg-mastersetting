"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { getCardsByIds } from "@/lib/api";
import { supabase } from "@/lib/supabase";
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

interface BreakdownRow {
  id: string;
  label: string;
  ownedCount: number;
  value: number;
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
        const priceMap = new Map<string, number>();
        for (const card of cards) {
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
            for (const cardId of item.ownedCards) {
              itemValue += priceMap.get(cardId) ?? 0;
            }
            return { id: item.id, label: item.label, ownedCount: item.ownedCards.length, value: itemValue };
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
        setSnapshots((data ?? []).map((r: { recorded_at: string; value: string }) => ({
          recorded_at: r.recorded_at,
          value: Number(r.value),
        })));
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

      {breakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Breakdown by Set</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {breakdown.map((row) => (
              <div key={row.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{row.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{row.ownedCount} cards owned</p>
                </div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">${row.value.toFixed(2)}</p>
              </div>
            ))}
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
