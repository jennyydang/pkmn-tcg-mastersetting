"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCardData } from "@/lib/cardData";
import { useAuth } from "@/lib/auth";
import { VARIANT_LABELS, parseOwnedKey } from "@/lib/variants";
import { useCollectionValue } from "@/lib/collectionValue";
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
  setTotal: number;
  /** Value of all copies (price for their condition × quantity). */
  price: number | null;
  quantity: number;
  grade: string | null;
  condition: string | null;
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
  const { details } = useCardData();

  const { loading, valuation } = useCollectionValue();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
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

  const totalValue = valuation?.total ?? 0;
  // The same cards at the Near Mint market price, to compare with your conditions.
  const marketValue = valuation?.marketTotal ?? 0;
  const cardCount = valuation?.count ?? 0;

  // Cards with a price paid recorded: what they cost and what they're worth now.
  const costBasis = useMemo(() => {
    if (!valuation) return null;
    let paid = 0, worth = 0, copies = 0;
    for (const key of valuation.keys) {
      const d = details.get(key);
      if (d?.purchasePrice == null) continue;
      paid += d.purchasePrice * d.quantity;
      worth += (valuation.unitValue(key) ?? 0) * d.quantity;
      copies += d.quantity;
    }
    return copies > 0 ? { paid, worth, copies } : null;
  }, [valuation, details]);

  const breakdown = useMemo<BreakdownRow[]>(() => {
    if (!valuation) return [];
    const row = (id: string, label: string, keys: string[]): BreakdownRow => {
      let itemValue = 0;
      const itemCards: CardRow[] = keys.map((key) => {
        const d = details.get(key);
        const quantity = valuation.quantity(key);
        const unit = valuation.unitValue(key);
        const price = unit != null ? unit * quantity : null;
        itemValue += price ?? 0;
        const { cardId, variant } = parseOwnedKey(key);
        const card = valuation.cardById.get(cardId);
        const name = card ? (variant ? `${card.name} (${VARIANT_LABELS[variant].long})` : card.name) : cardId;
        const grade = d?.gradeCompany ? `${d.gradeCompany} ${d.grade ?? ""}`.trim() : null;
        return {
          id: key, name, number: card?.number ?? "", setTotal: card ? card.set.printedTotal ?? card.set.total : 0,
          price, quantity, grade, condition: grade ? null : d?.condition ?? null,
        };
      });
      itemCards.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      return { id, label, ownedCount: keys.length, value: itemValue, cards: itemCards };
    };
    const inSets = new Set(trackedItems.flatMap((t) => t.ownedCards));
    return [
      ...trackedItems.map((item) => row(item.id, item.label, item.ownedCards)),
      row("__collection", "Other cards in My Collection", [...valuation.keys].filter((k) => !inSets.has(k))),
    ]
      .filter((r) => r.ownedCount > 0)
      .sort((a, b) => b.value - a.value);
  }, [valuation, details, trackedItems]);

  // Record today's value (one snapshot per day) and load the history.
  const snapshotValue = valuation ? Math.round(valuation.total * 100) / 100 : null;
  useEffect(() => {
    if (!user || snapshotValue == null || cardCount === 0) return;
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("portfolio_snapshots").upsert(
        { user_id: user.id, value: snapshotValue, card_count: cardCount, recorded_at: today },
        { onConflict: "user_id,recorded_at" }
      );
      const { data } = await supabase
        .from("portfolio_snapshots")
        .select("recorded_at, value")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: true })
        .limit(90);
      if (cancelled) return;
      setSnapshots((data ?? []).map((r: { recorded_at: string; value: string }) => ({ recorded_at: r.recorded_at, value: Number(r.value) })));
    })();
    return () => { cancelled = true; };
  }, [user, snapshotValue, cardCount]);

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
            <>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">${totalValue.toFixed(2)}</p>
              {Math.abs(marketValue - totalValue) >= 0.01 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  For your cards’ conditions. Near Mint value ${marketValue.toFixed(2)}
                  <span className="text-red-500 dark:text-red-400"> (−${(marketValue - totalValue).toFixed(2)})</span>
                </p>
              )}
            </>
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
        {!loading && costBasis && (
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              Profit / Loss
            </p>
            <p className={`text-3xl font-bold ${costBasis.worth >= costBasis.paid ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
              {costBasis.worth >= costBasis.paid ? "+" : "−"}${Math.abs(costBasis.worth - costBasis.paid).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Paid ${costBasis.paid.toFixed(2)}, now worth ${costBasis.worth.toFixed(2)}, for the {costBasis.copies} {costBasis.copies === 1 ? "copy" : "copies"} with a price paid recorded.
              Values use the condition you set; graded cards are valued at the ungraded price.
            </p>
          </div>
        )}
      </div>

      {/* Line chart — always shown */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-8 shadow-sm">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Portfolio Value Over Time</p>
        {loading ? (
          <div className="flex items-center justify-center h-[220px]">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Loading chart" />
          </div>
        ) : snapshots.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-[220px] gap-2">
            <p className="text-sm text-gray-400 dark:text-gray-500">No history yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Visit again tomorrow to see your first data point.</p>
          </div>
        ) : (
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
        )}
      </div>

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
                        <p className="text-xs text-gray-400 dark:text-gray-500">{row.ownedCount} {row.ownedCount === 1 ? "card" : "cards"} owned</p>
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
                          className={`flex items-center gap-3 pl-12 pr-5 py-2 ${
                            i < row.cards.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""
                          }`}
                        >
                          <p className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate">
                            {card.quantity > 1 && <span className="font-semibold">{card.quantity}× </span>}
                            {card.name}
                            {card.grade && <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">{card.grade}</span>}
                            {card.condition && card.condition !== "NM" && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] font-semibold">{card.condition}</span>}
                            {card.number && (
                              <span className="text-gray-500 dark:text-gray-400 ml-1 font-mono">
                                #{card.number}{card.setTotal > 0 ? `/${card.setTotal}` : ""}
                              </span>
                            )}
                          </p>
                          <p className={`text-sm shrink-0 ${card.price != null ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
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
