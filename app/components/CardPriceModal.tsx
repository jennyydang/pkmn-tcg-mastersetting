"use client";

import { PokemonCard } from "@/lib/types";
import Image from "next/image";

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
  if (!loading && !card) return null;

  const prices = card?.tcgplayer?.prices;
  const hasPrices = prices && Object.keys(prices).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          {card && (
            <Image
              src={card.images.small}
              alt={card.name}
              width={56}
              height={78}
              className="rounded shrink-0 shadow-sm"
              unoptimized
            />
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            {card ? (
              <>
                <h2 className="font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">{card.name}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {card.set.name} #{card.number}{card.rarity ? ` · ${card.rarity}` : ""}
                </p>
              </>
            ) : (
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasPrices ? (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 py-6">No pricing data available</p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">TCGPlayer Market Prices</p>
              <div className="space-y-3">
                {Object.entries(prices!).map(([type, p]) => (
                  <div key={type} className="rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{formatPriceType(type)}</span>
                      <span className="text-base font-bold text-blue-600 dark:text-blue-400">{fmt(p.market)}</span>
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

        {/* Footer */}
        {!loading && card?.tcgplayer && (
          <div className="px-5 pb-5 flex items-center justify-between gap-3">
            {card.tcgplayer.url ? (
              <a
                href={card.tcgplayer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
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
    </div>
  );
}
