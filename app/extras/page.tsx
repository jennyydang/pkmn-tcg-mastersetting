"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCardData } from "@/lib/cardData";
import { getCardsByIds } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { parseOwnedKey } from "@/lib/variants";
import { staggerStyle } from "@/lib/motion";
import { successFeedback } from "@/lib/haptics";
import { extrasFromDetails, rowLabel, tradeListImage, tradeListText, tradeListUrl, tradeRows } from "@/lib/trade";
import CardImage from "@/app/components/CardImage";
import { CheckIcon, ChevronRightIcon, MinusIcon, PlusIcon, ShareIcon } from "@/app/components/Icons";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function ExtrasPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { available, details, saveDetails } = useCardData();
  const [cards, setCards] = useState<Map<string, PokemonCard>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<"link" | "image" | "text" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  const entries = useMemo(() => extrasFromDetails(details), [details]);
  const missingIds = useMemo(
    () => [...new Set(entries.map((e) => parseOwnedKey(e.key).cardId))].filter((id) => !cards.has(id)),
    [entries, cards]
  );
  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    getCardsByIds(missingIds)
      .then((fetched) => {
        if (cancelled) return;
        setError(null);
        setCards((prev) => {
          const next = new Map(prev);
          for (const c of fetched) next.set(c.id, c);
          return next;
        });
      })
      .catch(() => { if (!cancelled) setError("Couldn’t load card details. Try again in a minute."); });
    return () => { cancelled = true; };
  }, [missingIds]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const rows = tradeRows(entries, cards).sort((a, b) => (b.price ?? -1) * b.count - (a.price ?? -1) * a.count);
  const total = rows.reduce((n, r) => n + r.count, 0);
  const value = rows.reduce((sum, r) => sum + (r.price ?? 0) * r.count, 0);
  const loading = missingIds.length > 0 && !error;

  // Extras = copies − 1, so changing the extras changes the saved copy count.
  function setExtras(key: string, extras: number) {
    const d = details.get(key);
    if (d) saveDetails(key, { ...d, quantity: extras + 1 });
  }

  async function share(kind: "link" | "image" | "text") {
    setSharing(kind);
    try {
      const url = tradeListUrl(entries);
      if (kind === "image") {
        const file = new File([await tradeListImage(rows)], "trade-list.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "Trade list" });
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 10000);
          setNotice("Image downloaded.");
        }
      } else {
        const text = kind === "text" ? tradeListText(rows, url) : url;
        if (kind === "link" && navigator.share) {
          await navigator.share({ title: "My trade list", text: `My trade list: ${total} ${total === 1 ? "card" : "cards"}`, url });
        } else {
          await navigator.clipboard.writeText(text);
          setNotice(kind === "link" ? "Link copied." : "List copied. Paste it anywhere.");
          successFeedback();
        }
      }
    } catch (e) {
      // Closing the share sheet isn't an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.error("Share failed", e);
        setNotice("Couldn’t share. Try again.");
      }
    } finally {
      setSharing(null);
    }
  }

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const shareButton = "flex flex-col items-center justify-center gap-1 min-h-[64px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-blue-400 disabled:opacity-50 transition-colors";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/collection" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Collection</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">Extras</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Extras for trade</h1>
        {entries.length > 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} {total === 1 ? "card" : "cards"} beyond the one you keep{value > 0 ? ` · about ${fmt(value)}` : ""}
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {available
              ? "When you have more than one copy of a card, the extras show up here, ready to share as a trade list. Set copies with a card’s “i” button, or scan the same card more than once in Many cards mode."
              : "Copy counts aren’t set up yet (run supabase/wants_and_copies.sql in Supabase)."}
          </p>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => share("link")} disabled={!!sharing} className={shareButton}>
            <ShareIcon className="w-5 h-5" /> {sharing === "link" ? "Sharing…" : "Share link"}
          </button>
          <button onClick={() => share("image")} disabled={!!sharing || loading} className={shareButton}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {sharing === "image" ? "Making image…" : "Share image"}
          </button>
          <button onClick={() => share("text")} disabled={!!sharing || loading} className={shareButton}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copy as text
          </button>
        </div>
      )}
      <div role="status" aria-live="polite" className="min-h-0">
        {notice && <p className="fade-in flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400"><CheckIcon className="w-4 h-4" />{notice}</p>}
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      {loading && rows.length === 0 && (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      )}

      <ul className="space-y-2">
        {rows.map((row, i) => {
          const label = rowLabel(row);
          return (
            <li key={row.key} style={staggerStyle(i)} className="stagger-in flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
              <CardImage src={row.card.images.small} alt="" width={44} height={62} className="rounded shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{row.card.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{row.card.set.name} · #{row.card.number}{label ? ` · ${label}` : ""}</p>
                <p className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200 mt-0.5">
                  {row.price != null ? `${fmt(row.price)} each${row.graded ? " (ungraded price)" : ""}` : "No price"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Extra copies of ${row.card.name}`}>
                <button onClick={() => setExtras(row.key, row.count - 1)} aria-label={row.count === 1 ? "Remove from extras (traded or kept)" : "One fewer"}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <MinusIcon className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums">×{row.count}</span>
                <button onClick={() => setExtras(row.key, row.count + 1)} aria-label="One more"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > 0 && (
        <p className="text-xs text-gray-400">
          You keep one copy of each; the rest are extras. Traded one away? Tap − to update your copy count. Prices are TCGplayer market prices (Cardmarket, converted to dollars, for Japanese cards), adjusted for condition where you’ve set it.
        </p>
      )}
    </div>
  );
}
