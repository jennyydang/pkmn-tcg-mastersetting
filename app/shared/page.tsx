"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { getCardsForArtist, getCardsForPokemon, getCardsForSet } from "@/lib/api";
import { SharedCollection, ShareError, getSharedCollection } from "@/lib/share";
import { PokemonCard, TrackedMasterSet } from "@/lib/types";
import { ownedCardIds } from "@/lib/variants";
import { staggerStyle } from "@/lib/motion";
import { APP_NAME } from "@/lib/appInfo";
import MasterSetCards from "@/app/components/MasterSetCards";
import MasterSetProgress from "@/app/components/MasterSetProgress";
import ProgressBar from "@/app/components/ProgressBar";
import { MasterSetSummary } from "@/app/components/PokemonMasterSetCard";
import { CardsIcon, ChevronRightIcon, ShareIcon } from "@/app/components/Icons";

// A collection someone shared (app/components/ShareCollectionSheet.tsx). Opens
// without an account: ?c=<token> lists their master sets, and &s=<set> shows
// one set's cards, owned and missing. Read-only, and always current.

export default function SharedCollectionPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SharedCollectionView />
    </Suspense>
  );
}

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      {label && <p className="text-gray-500 dark:text-gray-400 text-sm">{label}</p>}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-gray-500 dark:text-gray-400 py-24 space-y-3">{children}</div>;
}

const titleFor = (name: string | null) => (name ? `${name}’s collection` : "Shared collection");

function SharedCollectionView() {
  const params = useSearchParams();
  const token = params.get("c") ?? "";
  const setId = params.get("s");
  // Keyed by token, so a different link shows as loading until its data arrives.
  const [result, setResult] = useState<{ token: string; shared?: SharedCollection | null; error?: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSharedCollection(token)
      .then((shared) => { if (!cancelled) setResult({ token, shared }); })
      .catch((e) => {
        if (cancelled) return;
        setResult({ token, error: e instanceof ShareError && e.notSetUp ? e.message : "Couldn’t load this collection. Check your connection and refresh." });
      });
    return () => { cancelled = true; };
  }, [token]);

  const current = result?.token === token ? result : null;
  const shared = current?.shared;
  const error = current?.error;

  if (!token || shared === null) {
    return (
      <Message>
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">This link doesn’t work</p>
        <p className="text-sm">It may be mistyped, or its owner stopped sharing or made a new link.</p>
      </Message>
    );
  }
  if (error) return <Message><p className="text-red-500 dark:text-red-400">{error}</p></Message>;
  if (!shared) return <Spinner label="Loading collection…" />;

  const set = setId != null ? shared.sets.find((s) => s.id === setId) : undefined;
  if (setId != null && !set) {
    return (
      <Message>
        <p>That set isn’t in this collection any more.</p>
        <Link href={`/shared?c=${encodeURIComponent(token)}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">See the whole collection</Link>
      </Message>
    );
  }
  return set ? <SharedSet token={token} shared={shared} set={set} /> : <SharedOverview token={token} shared={shared} />;
}

function SharedOverview({ token, shared }: { token: string; shared: SharedCollection }) {
  const { user } = useAuth();
  const { sets } = shared;
  const owned = new Set(sets.flatMap((s) => [...ownedCardIds(s.ownedCards)])).size;
  const complete = sets.filter((s) => s.type === "custom" ? s.status === "complete" : s.totalCards > 0 && ownedCardIds(s.ownedCards).size >= s.totalCards).length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex items-start gap-4">
        <span className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <ShareIcon className="w-6 h-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{titleFor(shared.name)}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sets.length} master {sets.length === 1 ? "set" : "sets"} · {owned} {owned === 1 ? "card" : "cards"} collected
            {complete > 0 && ` · ${complete} complete`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Open a set to see which cards are still missing.</p>
        </div>
      </div>

      {sets.length === 0 ? (
        <Message>
          <CardsIcon className="w-14 h-14 mx-auto text-gray-300 dark:text-gray-600" />
          <p>No master sets yet.</p>
        </Message>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sets.map((s, i) => (
            <li key={s.id} style={staggerStyle(i)} className="stagger-in">
              <Link
                href={`/shared?c=${encodeURIComponent(token)}&s=${encodeURIComponent(s.id)}`}
                className="tile block p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <MasterSetSummary tracked={s} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!user && <SignUpLink />}
    </div>
  );
}

function SignUpLink() {
  return (
    <Link href="/" className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
      Track your own cards and share your collection with {APP_NAME}
    </Link>
  );
}

/** Cards in a shared set. Custom sets carry their own card list; the rest are looked up. */
async function loadCards(set: TrackedMasterSet): Promise<PokemonCard[]> {
  switch (set.type) {
    case "set":     return getCardsForSet(set.id);
    case "pokemon": return getCardsForPokemon(set.id);
    case "artist":  return getCardsForArtist(set.id);
    case "custom":
      return (set.customCards ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        // TCGdex IDs end in the card number ("sv03.5-025").
        number: c.id.includes("-") ? c.id.slice(c.id.lastIndexOf("-") + 1) : "",
        images: { small: c.imageSmall, large: c.imageSmall },
        set: { id: "", name: c.setName, series: "", printedTotal: 0, total: 0, releaseDate: "", images: { symbol: "", logo: "" } },
      }));
  }
}

function SharedSet({ token, shared, set }: { token: string; shared: SharedCollection; set: TrackedMasterSet }) {
  const { user } = useAuth();
  // Keyed by set, so another set shows as loading until its cards arrive.
  const [result, setResult] = useState<{ set: TrackedMasterSet; cards?: PokemonCard[]; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCards(set)
      .then((cards) => { if (!cancelled) setResult({ set, cards }); })
      .catch(() => { if (!cancelled) setResult({ set, error: "Couldn’t load the cards. Check your connection and refresh." }); });
    return () => { cancelled = true; };
  }, [set]);

  const cards = result?.set === set ? result.cards ?? null : null;
  const error = result?.set === set ? result.error ?? null : null;

  const ongoingCustom = set.type === "custom" && set.status !== "complete";

  return (
    <div>
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6 min-w-0">
        <Link href={`/shared?c=${encodeURIComponent(token)}`} className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors truncate">{titleFor(shared.name)}</Link>
        <ChevronRightIcon className="w-4 h-4 shrink-0" />
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">{set.label}</span>
      </nav>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {set.type === "set" && set.image && (
            <Image src={set.image} alt={set.label} width={200} height={70} className="object-contain max-h-16 w-auto" unoptimized />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-0.5">{set.label}</h1>
            {set.subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{set.subtitle}</p>}
            {cards && (set.type === "custom"
              ? <ProgressBar owned={ownedCardIds(set.ownedCards).size} total={set.totalCards} status={ongoingCustom ? "ongoing" : "complete"} />
              : <MasterSetProgress cards={cards} ownedKeys={set.ownedCards} completeLabel="Master Set Complete!" />)}
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
      ) : !cards ? (
        <Spinner label="Loading cards…" />
      ) : (
        <MasterSetCards cards={cards} ownedKeys={set.ownedCards} showSetNames={set.type !== "set"} />
      )}

      {!user && <div className="mt-8"><SignUpLink /></div>}
    </div>
  );
}
