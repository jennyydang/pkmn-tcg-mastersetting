"use client";

import { useEffect, useRef, useState } from "react";
import { searchCards } from "@/lib/api";
import { ScanText } from "@/lib/cardScan";
import { PokemonCard } from "@/lib/types";
import { tapFeedback } from "@/lib/haptics";
import { staggerStyle } from "@/lib/motion";
import CardImage from "@/app/components/CardImage";
import { SearchIcon } from "@/app/components/Icons";

// Camera and "which card is it?" steps, shared by single and batch scanning (app/scan/page.tsx).

// Card proportions (63 × 88 mm); the on-screen guide uses the same shape.
const CARD_RATIO = 63 / 88;

/** `overlay` is drawn over the camera view (batch scanning puts its tray there). */
export function CameraStep({ onCard, onManual, overlay }: { onCard: (canvas: HTMLCanvasElement) => void; onManual: () => void; overlay?: React.ReactNode }) {
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
        {overlay}
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

export function PickStep({ scan, candidates, onPick, onRetry, retryLabel = "Scan again" }: { scan: ScanText | null; candidates: PokemonCard[]; onPick: (c: PokemonCard) => void; onRetry: () => void; retryLabel?: string }) {
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
        <button onClick={onRetry} className="text-sm font-medium text-blue-600 dark:text-blue-400">{retryLabel}</button>
      </div>
      {read && <p className="text-sm text-gray-500 dark:text-gray-400">Read: {read}</p>}
      {scan && !candidates.length && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Try again with the card flat, filling the frame, in brighter light. Or search below.</p>
      )}

      <form onSubmit={search} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <SearchIcon className="w-4 h-4 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or number, e.g. 025/165"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100" aria-label="Search cards" />
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
