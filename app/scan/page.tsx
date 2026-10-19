"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useCardData, CONDITIONS } from "@/lib/cardData";
import { getCard, searchCards } from "@/lib/api";
import { findCandidates, getOcrWorker, nameMatches, readCard, ScanText } from "@/lib/cardScan";
import { conditionPrice } from "@/lib/conditions";
import { PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, ownedKey, variantPrice } from "@/lib/variants";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { staggerStyle } from "@/lib/motion";
import CardImage from "@/app/components/CardImage";
import { CheckIcon, SearchIcon, StarIcon } from "@/app/components/Icons";

// Card proportions (63 × 88 mm); the on-screen guide uses the same shape.
const CARD_RATIO = 63 / 88;

type Step =
  | { kind: "camera" }
  | { kind: "reading" }
  | { kind: "pick"; scan: ScanText | null; candidates: PokemonCard[] }
  | { kind: "result"; card: PokemonCard; loading: boolean };

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function ScanPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>({ kind: "camera" });

  useEffect(() => {
    if (!authLoading && !user) router.replace("/");
  }, [user, authLoading, router]);

  // Start loading the OCR engine while the user lines up the card.
  useEffect(() => { getOcrWorker().catch(() => {}); }, []);

  async function handleCard(canvas: HTMLCanvasElement) {
    setStep({ kind: "reading" });
    try {
      const scan = await readCard(canvas);
      const candidates = await findCandidates(scan);
      tapFeedback();
      // Go straight to the card when only one candidate fits both number and name.
      const named = scan.name ? candidates.filter((c) => nameMatches(c.name, scan.name!)) : [];
      if (candidates.length === 1) pick(candidates[0]);
      else if (scan.number && named.length === 1) pick(named[0]);
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

  if (authLoading || !user) return null;

  return (
    <div className="max-w-xl mx-auto">
      {step.kind === "camera" && <CameraStep onCard={handleCard} onManual={() => setStep({ kind: "pick", scan: null, candidates: [] })} />}
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
    </div>
  );
}

function CameraStep({ onCard, onManual }: { onCard: (canvas: HTMLCanvasElement) => void; onManual: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError("Camera unavailable. Allow camera access in Settings, or choose a photo instead."));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Crop the video frame to the on-screen guide. The video fills its box
  // (object-cover), so map the guide's screen position back into video pixels.
  function capture() {
    const video = videoRef.current, guide = guideRef.current;
    if (!video || !guide || !video.videoWidth) return;
    const box = video.getBoundingClientRect(), g = guide.getBoundingClientRect();
    const scale = Math.max(box.width / video.videoWidth, box.height / video.videoHeight);
    const offsetX = (video.videoWidth * scale - box.width) / 2;
    const offsetY = (video.videoHeight * scale - box.height) / 2;
    const sx = (g.left - box.left + offsetX) / scale, sy = (g.top - box.top + offsetY) / scale;
    const sw = g.width / scale, sh = g.height / scale;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext("2d")!.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    tapFeedback();
    onCard(canvas);
  }

  // A chosen photo is assumed to be mostly card; crop to card proportions from the centre.
  function fromFile(file: File) {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w / h > CARD_RATIO) w = h * CARD_RATIO; else h = w / CARD_RATIO;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
      canvas.getContext("2d")!.drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      onCard(canvas);
    };
    img.src = URL.createObjectURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="relative -mx-4 sm:mx-0 bg-black sm:rounded-2xl overflow-hidden aspect-[3/4] max-h-[65dvh] w-[calc(100%+2rem)] sm:w-full">
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-gray-300">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        )}
        {/* Card-shaped guide with the area outside it dimmed. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div ref={guideRef} className="h-[80%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ aspectRatio: `${CARD_RATIO}` }} />
        </div>
        <p className="absolute top-3 inset-x-0 text-center text-xs font-medium text-white/90 drop-shadow">
          Fill the frame with the card, in good light
        </p>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button onClick={() => fileRef.current?.click()} className="text-sm font-medium text-blue-600 dark:text-blue-400 w-24">Choose photo</button>
        <button onClick={capture} disabled={!!error} aria-label="Scan card"
          className="w-[72px] h-[72px] rounded-full border-4 border-blue-600 bg-white dark:bg-gray-100 shadow-lg active:scale-90 transition-transform disabled:opacity-40 flex items-center justify-center">
          <span className="w-14 h-14 rounded-full bg-blue-600" />
        </button>
        <button onClick={onManual} className="text-sm font-medium text-blue-600 dark:text-blue-400 w-24">Type it in</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) fromFile(f); e.target.value = ""; }} />
      <p className="text-center text-xs text-gray-400">Cards are read on your phone; photos aren’t uploaded or saved.</p>
    </div>
  );
}

function PickStep({ scan, candidates, onPick, onRetry }: { scan: ScanText | null; candidates: PokemonCard[]; onPick: (c: PokemonCard) => void; onRetry: () => void }) {
  const [query, setQuery]     = useState(scan?.name ?? "");
  const [results, setResults] = useState(candidates);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setResults(await searchCards(query).catch(() => []));
    setSearching(false);
  }

  const read = scan && [scan.name, scan.number && `#${scan.number}${scan.total ? `/${scan.total}` : ""}`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{candidates.length ? "Which card is it?" : scan ? "Couldn’t match that card" : "Find a card"}</h1>
        <button onClick={onRetry} className="text-sm font-medium text-blue-600 dark:text-blue-400">Scan again</button>
      </div>
      {read && <p className="text-sm text-gray-500 dark:text-gray-400">Read: {read}</p>}
      {scan && !candidates.length && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Try again with the card flat, filling the frame, in brighter light. Or search below.</p>
      )}

      <form onSubmit={search} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <SearchIcon className="w-4 h-4 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number, e.g. 025/165"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100" aria-label="Search cards" />
        </div>
        <button type="submit" className="px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold">{searching ? "…" : "Search"}</button>
      </form>

      <ul className="grid grid-cols-3 gap-3">
        {results.slice(0, 18).map((card, i) => (
          <li key={card.id} className="stagger-in" style={staggerStyle(i)}>
            <button onClick={() => onPick(card)} className="tile w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <CardImage src={card.images.small} alt={card.name} width={146} height={204} className="w-full h-auto rounded-lg shadow-sm" />
              <span className="block mt-1 text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{card.name}</span>
              <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{card.set.name} · #{card.number}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultStep({ card, loading, onScanAnother }: { card: PokemonCard; loading: boolean; onScanAnother: () => void }) {
  const { addCollectionCard, isInCollection } = useStore();
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
            Near Mint is the TCGplayer market price{card.tcgplayer?.updatedAt ? ` (updated ${new Date(card.tcgplayer.updatedAt).toLocaleDateString()})` : ""}.
            Other conditions are estimates using common discounts.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { addCollectionCard(card.id); successFeedback(); }} disabled={inCollection}
          className="flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-green-600 text-white text-sm font-semibold transition-colors">
          {inCollection ? <><CheckIcon className="w-4 h-4" /> In collection</> : "Add to collection"}
        </button>
        <button onClick={() => { setWant(wantKey, !isWanted(wantKey)); tapFeedback(); }}
          className="flex items-center justify-center gap-2 min-h-[48px] rounded-xl border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm font-semibold">
          <StarIcon className="w-4 h-4" filled={isWanted(wantKey)} /> {isWanted(wantKey) ? "On want list" : "Want"}
        </button>
      </div>

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
