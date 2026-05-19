"use client";

import { PokemonCard } from "@/lib/types";
import Image from "next/image";
import { useEffect, useState } from "react";

interface Props {
  card: PokemonCard | null;
  loading: boolean;
  onClose: () => void;
}

function formatPriceType(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function fmt(n?: number) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export default function CardPriceModal({ card, loading, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const prices = card?.tcgplayer?.prices;
  const hasPrices = prices && Object.keys(prices).length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 mb-1 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto max-h-[75vh] px-5 pb-2">
          {/* Card header row */}
          <div className="flex items-center gap-4 py-4 border-b border-gray-100 dark:border-gray-800">
            {card ? (
              <Image
                src={card.images.small}
                alt={card.name}
                width={56}
                height={78}
                className="rounded shadow-sm shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-14 h-[78px] rounded bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {card ? (
                <>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100 leading-tight">{card.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {card.set.name} #{card.number}{card.rarity ? ` · ${card.rarity}` : ""}
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Price content */}
          <div className="py-4">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !hasPrices ? (
              <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-8">No pricing data available</p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                  TCGPlayer Market Prices
                </p>
                <div className="space-y-3">
                  {Object.entries(prices!).map(([type, p]) => (
                    <div key={type} className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatPriceType(type)}</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmt(p.market)}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-500">
                        <span>Low {fmt(p.low)}</span>
                        <span>Mid {fmt(p.mid)}</span>
                        <span>High {fmt(p.high)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        {!loading && card?.tcgplayer && (
          <div className="px-5 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 shrink-0">
            {card.tcgplayer.url ? (
              <a
                href={card.tcgplayer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                View on TCGPlayer
              </a>
            ) : <div />}
            {card.tcgplayer.updatedAt && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                Updated {new Date(card.tcgplayer.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
