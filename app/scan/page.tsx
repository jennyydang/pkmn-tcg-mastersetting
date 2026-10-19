"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useCardData, CONDITIONS } from "@/lib/cardData";
import { getCard } from "@/lib/api";
import { confidentMatch, findCandidates, getOcrWorker, readCard, ScanText } from "@/lib/cardScan";
import { conditionPrice } from "@/lib/conditions";
import { useScanMode } from "@/lib/prefs";
import { PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedKey, variantPrice } from "@/lib/variants";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { staggerStyle } from "@/lib/motion";
import CardImage from "@/app/components/CardImage";
import { CheckIcon, StarIcon } from "@/app/components/Icons";
import { CameraStep, PickStep } from "./ScanSteps";
import BatchScan from "./BatchScan";
import AddToSetsSheet, { addedIntro } from "@/app/components/AddToSetsSheet";
import { useAddToCollection } from "@/lib/addCopies";
import { setFitsCard, setsHoldingCard } from "@/lib/setMembership";

type Step =
  | { kind: "camera" }
  | { kind: "reading" }
  | { kind: "pick"; scan: ScanText | null; candidates: PokemonCard[] }
  | { kind: "result"; card: PokemonCard; loading: boolean };

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function ScanPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useScanMode();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  // Start loading the OCR engine while the user lines up the card.
  useEffect(() => { getOcrWorker().catch(() => {}); }, []);

  if (authLoading || !user) return null;

  const toggle = (
    <div className="flex justify-center mb-4">
      <div className="inline-flex p-1 rounded-full bg-gray-100 dark:bg-gray-800" role="radiogroup" aria-label="Scan mode">
        {([["single", "One card"], ["batch", "Many cards"]] as const).map(([value, label]) => (
          <button key={value} role="radio" aria-checked={mode === value} onClick={() => setMode(value)}
            className={`px-4 min-h-[36px] rounded-full text-sm font-semibold transition-colors ${mode === value ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      {mode === "batch" ? <BatchScan toggle={toggle} /> : <SingleScan toggle={toggle} />}
    </div>
  );
}

/** One card at a time: scan, then see its prices by condition. */
function SingleScan({ toggle }: { toggle: React.ReactNode }) {
  const [step, setStep] = useState<Step>({ kind: "camera" });

  async function handleCard(canvas: HTMLCanvasElement) {
    setStep({ kind: "reading" });
    try {
      const scan = await readCard(canvas);
      const candidates = await findCandidates(scan);
      tapFeedback();
      // Go straight to the card when the scan clearly points to one.
      const match = confidentMatch(scan, candidates);
      if (match) pick(match);
      else setStep({ kind: "pick", scan, candidates });
    } catch (e) {
      console.error("Scan failed", e);
      setStep({ kind: "pick", scan: null, candidates: [] });
    }
  }

  async function pick(card: PokemonCard) {
    setStep({ kind: "result", card, loading: true });
    // Search results don't include prices or versions; load the full card.
    const full = await getCard(card.id).catch(() => card);
    setStep({ kind: "result", card: full, loading: false });
  }

  return (
    <>
      {step.kind === "camera" && <>{toggle}<CameraStep onCard={handleCard} onManual={() => setStep({ kind: "pick", scan: null, candidates: [] })} /></>}
      {step.kind === "reading" && (
        <div className="flex flex-col items-center justify-center py-32 gap-4" role="status">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Reading card…</p>
        </div>
      )}
      {step.kind === "pick" && (
        <PickStep scan={step.scan} candidates={step.candidates} onPick={pick} onRetry={() => setStep({ kind: "camera" })} />
      )}
      {step.kind === "result" && (
        <ResultStep card={step.card} loading={step.loading} onScanAnother={() => setStep({ kind: "camera" })} />
      )}
    </>
  );
}

function ResultStep({ card, loading, onScanAnother }: { card: PokemonCard; loading: boolean; onScanAnother: () => void }) {
  const { isInCollection, trackedItems } = useStore();
  const addToCollection = useAddToCollection();
  const [setsOpen, setSetsOpen] = useState<{ intro?: string } | null>(null);
  const fitsSomeSet = trackedItems.some((t) => setFitsCard(t, card));
  const setCount = setsHoldingCard(trackedItems, card.id).length;
  const { isWanted, setWant } = useCardData();
  const versions = cardVariants(card);
  const [variant, setVariant] = useState(versions[0]);
  const market = variantPrice(card, variant);
  const inCollection = isInCollection(card.id);
  const wantKey = ownedKey(card, variant);

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-start gap-4">
        <CardImage src={card.images.large} alt={card.name} width={245} height={342} className="w-32 sm:w-40 h-auto rounded-lg shadow-lg pop-in" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{card.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{card.set.name} · #{card.number}{card.rarity ? ` · ${card.rarity}` : ""}</p>
          {versions.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3" role="radiogroup" aria-label="Version">
              {versions.map((v) => (
                <button key={v} role="radio" aria-checked={variant === v} onClick={() => setVariant(v)}
                  className={`px-3 min-h-[36px] rounded-full text-xs font-semibold transition-colors ${variant === v ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"}`}>
                  {VARIANT_LABELS[v].long}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <h2 className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Price by condition</h2>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : market == null ? (
          <p className="px-5 pb-5 text-sm text-gray-500 dark:text-gray-400">No price data for this version.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {CONDITIONS.map((c, i) => (
              <li key={c.value} className="stagger-in flex items-center justify-between px-5 py-3" style={staggerStyle(i)}>
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="inline-block w-10 font-semibold text-gray-900 dark:text-gray-100">{c.value}</span>{c.label}
                </span>
                <span className={`tabular-nums font-semibold ${c.value === "NM" ? "text-lg text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"}`}>
                  {fmt(conditionPrice(market, c.value))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!loading && market != null && (
          <p className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40">
            Near Mint is the {card.priceSource === "cardmarket" ? "Cardmarket price trend, converted from euros" : "TCGplayer market price"}{card.tcgplayer?.updatedAt ? ` (updated ${new Date(card.tcgplayer.updatedAt).toLocaleDateString()})` : ""}.
            Other conditions are estimates using common discounts.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { const checked = addToCollection(card, variant); successFeedback(); if (fitsSomeSet) setSetsOpen({ intro: addedIntro(checked) }); }} disabled={inCollection}
          className="flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-green-600 text-white text-sm font-semibold transition-colors">
          {inCollection ? <><CheckIcon className="w-4 h-4" /> In collection</> : "Add to collection"}
        </button>
        <button onClick={() => { setWant(wantKey, !isWanted(wantKey)); tapFeedback(); }}
          className="flex items-center justify-center gap-2 min-h-[48px] rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-semibold">
          <StarIcon className="w-4 h-4" filled={isWanted(wantKey)} /> {isWanted(wantKey) ? "On want list" : "Want"}
        </button>
      </div>

      {fitsSomeSet && (
        <button onClick={() => setSetsOpen({})}
          className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {setCount > 0 ? `In ${setCount} of your ${setCount === 1 ? "set" : "sets"} · Change` : "Add to your master sets"}
        </button>
      )}
      {setsOpen && <AddToSetsSheet card={card} intro={setsOpen.intro} onClose={() => setSetsOpen(null)} />}

      <div className="flex items-center justify-between">
        <button onClick={onScanAnother} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 min-h-[44px]">
          Scan another card
        </button>
        {card.tcgplayer?.url && (
          <a href={card.tcgplayer.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">View on TCGplayer</a>
        )}
      </div>
    </div>
  );
}
