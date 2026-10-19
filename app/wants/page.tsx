"use client";

import { useEffect, useMemo, useState } from "react";
import CardImage from "@/app/components/CardImage";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { staggerStyle } from "@/lib/motion";
import { useCardData } from "@/lib/cardData";
import { useConfirm, wantRemovalPrompt } from "@/lib/confirm";
import { getCardsByIds } from "@/lib/api";
import { PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, parseOwnedKey, variantPrice } from "@/lib/variants";
import CardPriceModal from "@/app/components/CardPriceModal";
import { CheckIcon, ChevronRightIcon, StarIcon } from "@/app/components/Icons";

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function WantsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { available, wants, setWant } = useCardData();
  const confirm = useConfirm();
  const [cards, setCards]     = useState<Map<string, PokemonCard>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  // Fetch full cards (with prices) for anything on the list we haven't loaded yet.
  const keys = useMemo(() => [...wants.keys()], [wants]);
  const missingIds = useMemo(
    () => [...new Set(keys.map((k) => parseOwnedKey(k).cardId))].filter((id) => !cards.has(id)),
    [keys, cards]
  );
  useEffect(() => {
    if (missingIds.length === 0) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
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
      .catch(() => { if (!cancelled) setError("Couldn’t load prices. Try again in a minute."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [missingIds]);

  const rows = keys
    .map((key) => {
      const { cardId, variant } = parseOwnedKey(key);
      const card = cards.get(cardId);
      const target = wants.get(key) ?? null;
      const price = card ? variantPrice(card, variant) : undefined;
      return { key, card, variant, target, price, hit: target != null && price != null && price <= target };
    })
    .filter((r) => r.card)
    .sort((a, b) => Number(b.hit) - Number(a.hit) || (b.price ?? -1) - (a.price ?? -1));

  const hits = rows.filter((r) => r.hit).length;
  const total = rows.reduce((sum, r) => sum + (r.price ?? 0), 0);
  const open = rows.find((r) => r.key === openKey);

  if (authLoading || !user) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors">Home</Link>
        <ChevronRightIcon className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">Want List</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Want List</h1>
        {keys.length > 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {keys.length} {keys.length === 1 ? "card" : "cards"} · about {fmt(total)} to buy them all
            {hits > 0 && <> · <span className="font-semibold text-green-600 dark:text-green-400">{hits} at your target price</span></>}
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {available
              ? "Tap a card’s “i” button anywhere in the app and choose “Add to want list”. Set a target price and cards that drop to it are flagged here."
              : "The want list isn’t set up yet (run supabase/wants_and_copies.sql in Supabase)."}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
      {loading && rows.length === 0 && (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      )}

      <ul className="space-y-2">
        {rows.map(({ key, card, variant, target, price, hit }, i) => (
          <li key={key} style={staggerStyle(i)} className={`stagger-in flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl border p-3 shadow-sm ${hit ? "border-green-400 dark:border-green-600" : "border-gray-200 dark:border-gray-700"}`}>
            <button onClick={() => setOpenKey(key)} className="flex flex-1 min-w-0 items-center gap-3 text-left">
              <CardImage src={card!.images.small} alt="" width={44} height={62} className="rounded shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {card!.name}{variant && cardVariants(card!).length > 1 && <span className="text-gray-500 dark:text-gray-400"> · {VARIANT_LABELS[variant].long}</span>}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">#{card!.number} · {card!.set.name}</p>
                <p className="text-xs mt-0.5">
                  {hit ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400"><CheckIcon className="w-3.5 h-3.5" />At or below your {fmt(target!)} target</span>
                  ) : target != null ? (
                    <span className="text-gray-500 dark:text-gray-400">Target {fmt(target)}</span>
                  ) : null}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">{price != null ? fmt(price) : "No price"}</span>
            </button>
            <button onClick={async () => { if (await confirm(wantRemovalPrompt(card!.name, target))) setWant(key, false); }} aria-label={`Remove ${card!.name} from want list`}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30"><StarIcon className="w-5 h-5" filled /></button>
          </li>
        ))}
      </ul>

      {rows.length > 0 && <p className="text-xs text-gray-400">TCGplayer market prices (Cardmarket, converted to dollars, for Japanese cards), updated daily. Prices are checked when you open this page.</p>}

      {open && (
        <CardPriceModal card={open.card!} loading={false} cardKey={open.key} onClose={() => setOpenKey(null)} />
      )}
    </div>
  );
}
