"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCard } from "@/lib/api";
import { confidentMatch, findCandidates, readCard, ScanText } from "@/lib/cardScan";
import { useAddCopies } from "@/lib/addCopies";
import { useShutter } from "@/lib/scanShutter";
import { useConfirm } from "@/lib/confirm";
import { CardVariant, PokemonCard } from "@/lib/types";
import { VARIANT_LABELS, cardVariants, variantPrice } from "@/lib/variants";
import { successFeedback, tapFeedback } from "@/lib/haptics";
import { staggerStyle } from "@/lib/motion";
import CardImage from "@/app/components/CardImage";
import { CheckCircleIcon, CheckIcon, MinusIcon, PlusIcon, XIcon } from "@/app/components/Icons";
import { CameraStep, PickStep } from "./ScanSteps";

// Scan many cards in a row (sorting a pile, opening a booster box). Each card
// is read in the background while the camera stays open; the list is reviewed
// at the end and everything is added at once. The list is kept on the device,
// so leaving the page doesn't lose it.

interface BatchItem {
  id: string;
  status: "reading" | "matched" | "choose" | "unmatched";
  /** Small JPEG of the photo, shown until the card is identified. */
  thumb: string;
  count: number;
  card?: PokemonCard;
  variant?: CardVariant;
  scan?: ScanText;
  candidates?: PokemonCard[];
}

type View =
  | { kind: "camera" }
  | { kind: "review" }
  | { kind: "pick"; itemId: string | null; from: "camera" | "review" }
  | { kind: "done"; cards: number; setsTicked: number };

const STORAGE_KEY = "pocketi-batch-scan";
const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

function loadItems(): BatchItem[] {
  try {
    const items: BatchItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    // A read cut short by leaving the page won't finish; let the user pick instead.
    return items.map((i) => (i.status === "reading" ? { ...i, status: "unmatched" } : i));
  } catch {
    return [];
  }
}

function thumbnailOf(canvas: HTMLCanvasElement) {
  const out = document.createElement("canvas");
  out.width = 96;
  out.height = Math.round((96 * canvas.height) / canvas.width);
  out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.6);
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export default function BatchScan({ toggle }: { toggle: React.ReactNode }) {
  const [items, setItems] = useState<BatchItem[]>(() => (typeof window === "undefined" ? [] : loadItems()));
  const [view, setView] = useState<View>({ kind: "camera" });
  const [toast, setToast] = useState<{ text: string; ok: boolean; key: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const addCopies = useAddCopies();
  // From review, a search or the summary, the tab bar's camera button goes back to the camera.
  useShutter(() => { setView({ kind: "camera" }); window.scrollTo({ top: 0 }); }, view.kind !== "camera");
  const confirm = useConfirm();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (id: string, changes: Partial<BatchItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  /** Mark an item as this card; a second copy of a card already listed adds to its count. */
  function resolve(id: string, card: PokemonCard) {
    const variant = cardVariants(card)[0];
    setItems((prev) => {
      const same = prev.find((i) => i.id !== id && i.status === "matched" && i.card?.id === card.id && i.variant === variant);
      if (same) return prev.filter((i) => i.id !== id).map((i) => (i === same ? { ...i, count: i.count + 1 } : i));
      return prev.map((i) => (i.id === id ? { ...i, status: "matched", card, variant, scan: undefined, candidates: undefined } : i));
    });
  }

  async function onCard(canvas: HTMLCanvasElement) {
    const id = newId();
    setItems((prev) => [{ id, status: "reading", thumb: thumbnailOf(canvas), count: 1 }, ...prev]);
    try {
      const scan = await readCard(canvas);
      const candidates = await findCandidates(scan);
      const match = confidentMatch(scan, candidates);
      if (match) {
        // Search results don't include prices or versions; load the full card.
        resolve(id, await getCard(match.id).catch(() => match));
        tapFeedback();
        setToast({ text: `${match.name} · ${match.set.name} #${match.number}`, ok: true, key: Date.now() });
      } else {
        update(id, { status: candidates.length ? "choose" : "unmatched", scan, candidates: candidates.slice(0, 18) });
        setToast({ text: "Couldn’t tell which card. You can pick it when you review.", ok: false, key: Date.now() });
      }
    } catch (e) {
      console.error("Scan failed", e);
      update(id, { status: "unmatched" });
    }
  }

  async function picked(card: PokemonCard, itemId: string | null, from: "camera" | "review") {
    const full = await getCard(card.id).catch(() => card);
    if (itemId) {
      resolve(itemId, full);
    } else {
      const id = newId();
      setItems((prev) => [{ id, status: "reading", thumb: "", count: 1 }, ...prev]);
      resolve(id, full);
    }
    setView({ kind: from });
  }

  async function addAll() {
    const matched = items.filter((i) => i.status === "matched" && i.card && i.variant);
    setAdding(true);
    const { setsTicked } = await addCopies(matched.map((i) => ({ card: i.card!, variant: i.variant!, count: i.count })));
    setAdding(false);
    successFeedback();
    setItems((prev) => prev.filter((i) => i.status !== "matched"));
    setView({ kind: "done", cards: matched.reduce((n, i) => n + i.count, 0), setsTicked });
  }

  const matched = items.filter((i) => i.status === "matched");
  const cardCount = matched.reduce((n, i) => n + i.count, 0);
  const reading = items.filter((i) => i.status === "reading").length;
  const unresolved = items.filter((i) => i.status === "choose" || i.status === "unmatched").length;
  const value = matched.reduce((sum, i) => sum + (variantPrice(i.card!, i.variant!) ?? 0) * i.count, 0);

  if (view.kind === "pick") {
    const item = view.itemId ? items.find((i) => i.id === view.itemId) : undefined;
    return (
      <PickStep
        scan={item?.scan ?? null}
        candidates={item?.candidates ?? []}
        onPick={(card) => picked(card, view.itemId, view.from)}
        onRetry={() => setView({ kind: view.from })}
        retryLabel="Back"
      />
    );
  }

  if (view.kind === "done") {
    return (
      <div className="fade-in flex flex-col items-center text-center py-16 gap-3">
        <CheckCircleIcon className="w-16 h-16 text-green-500 pop-in" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Added {view.cards} {view.cards === 1 ? "card" : "cards"}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          They’re in your collection{view.setsTicked > 0 ? `, and ${view.setsTicked} ${view.setsTicked === 1 ? "was" : "were"} checked off in your master sets` : ""}.
          {" "}Duplicates show up in your <Link href="/extras" className="text-blue-600 dark:text-blue-400 font-medium">Extras</Link> for trading.
        </p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setView({ kind: "camera" })} className="px-5 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-semibold">Scan more</button>
          <Link href="/collection" className="px-5 min-h-[44px] flex items-center rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">View collection</Link>
        </div>
      </div>
    );
  }

  if (view.kind === "review") {
    return (
      <div className="space-y-4 fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Review scans</h1>
          <button onClick={() => setView({ kind: "camera" })} className="text-sm font-medium text-blue-600 dark:text-blue-400 min-h-[44px]">Keep scanning</button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Nothing scanned yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={item.id} style={staggerStyle(i)} className="stagger-in flex items-center gap-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm">
                {item.status === "matched" ? (
                  <MatchedRow item={item} onChange={(c) => update(item.id, c)} />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL of the photo */}
                    {item.thumb && <img src={item.thumb} alt="" className="w-11 h-auto rounded shrink-0" />}
                    <div className="flex-1 min-w-0">
                      {item.status === "reading" ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> Reading…
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {item.status === "choose" ? "Which card is this?" : "Couldn’t read this card"}
                          </p>
                          {item.scan?.name && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Read: {item.scan.name}{item.scan.number ? ` · #${item.scan.number}` : ""}</p>}
                        </>
                      )}
                    </div>
                    {item.status !== "reading" && (
                      <button onClick={() => setView({ kind: "pick", itemId: item.id, from: "review" })}
                        className="px-3 min-h-[36px] rounded-full bg-blue-600 text-white text-xs font-semibold shrink-0">
                        {item.status === "choose" ? "Choose" : "Find it"}
                      </button>
                    )}
                  </>
                )}
                <button onClick={async () => { if (await confirm({ title: `Remove ${item.card?.name ?? "this scan"} from the list?`, message: item.count > 1 ? `All ${item.count} copies will be removed.` : undefined })) remove(item.id); }} aria-label="Remove from list"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                  <XIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">{cardCount} {cardCount === 1 ? "card" : "cards"} ready</span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">about {fmt(value)}</span>
            </div>
            {(unresolved > 0 || reading > 0) && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {reading > 0 ? `${reading} still reading. ` : ""}
                {unresolved > 0 ? `${unresolved} ${unresolved === 1 ? "needs" : "need"} a card picked, or ${unresolved === 1 ? "it" : "they"} won’t be added.` : ""}
              </p>
            )}
            <button onClick={addAll} disabled={cardCount === 0 || adding}
              className="w-full min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
              {adding ? "Adding…" : `Add ${cardCount} ${cardCount === 1 ? "card" : "cards"} to collection`}
            </button>
            <button onClick={async () => { if (await confirm({ title: "Clear every card from this list?", message: "Scans you haven’t added to your collection will be lost.", confirmLabel: "Clear list" })) setItems([]); }}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:underline">
              Clear list
            </button>
          </div>
        )}
      </div>
    );
  }

  // Camera, with what's been scanned so far laid over the bottom of the view.
  return (
    <>
      {toggle}
      <CameraStep
        onCard={onCard}
        onManual={() => setView({ kind: "pick", itemId: null, from: "camera" })}
        overlay={
          <>
            <div className="absolute top-10 inset-x-3 flex justify-center pointer-events-none" role="status" aria-live="polite">
              {toast && (
                <p key={toast.key} className={`fade-in max-w-full flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg ${toast.ok ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>
                  {toast.ok && <CheckIcon className="w-4 h-4 shrink-0" />}<span className="truncate">{toast.text}</span>
                </p>
              )}
            </div>
            {items.length > 0 && (
              <div className="absolute bottom-3 inset-x-3 flex items-center gap-3 rounded-2xl bg-black/50 p-2">
                <ul className="flex-1 flex gap-1.5 overflow-x-auto" aria-label="Scanned cards">
                  {items.slice(0, 12).map((item) => (
                    <li key={item.id} className="relative shrink-0 w-9 pop-in">
                      {item.card ? (
                        <CardImage src={item.card.images.small} alt={item.card.name} width={36} height={50} className="w-9 h-auto rounded" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- a data: URL of the photo
                        <img src={item.thumb} alt="" className={`w-9 h-auto rounded ${item.status === "reading" ? "opacity-50 animate-pulse" : "ring-2 ring-amber-400"}`} />
                      )}
                      {item.count > 1 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{item.count}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setView({ kind: "review" })} className="shrink-0 px-4 min-h-[44px] rounded-xl bg-white text-gray-900 text-sm font-semibold">
                  Review {cardCount + unresolved + reading}
                </button>
              </div>
            )}
          </>
        }
      />
    </>
  );
}

function MatchedRow({ item, onChange }: { item: BatchItem; onChange: (changes: Partial<BatchItem>) => void }) {
  const card = item.card!;
  const versions = cardVariants(card);
  const price = variantPrice(card, item.variant!);
  return (
    <>
      <CardImage src={card.images.small} alt="" width={44} height={62} className="rounded shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.set.name} · #{card.number}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {versions.length > 1 && (
            <select value={item.variant} onChange={(e) => onChange({ variant: e.target.value as CardVariant })} aria-label={`Version of ${card.name}`}
              className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-1.5 py-1 max-w-[120px]">
              {versions.map((v) => <option key={v} value={v}>{VARIANT_LABELS[v].long}</option>)}
            </select>
          )}
          <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{price != null ? fmt(price * item.count) : "No price"}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" role="group" aria-label={`Copies of ${card.name}`}>
        <button onClick={() => onChange({ count: Math.max(1, item.count - 1) })} disabled={item.count <= 1} aria-label="One fewer"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40">
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.count}</span>
        <button onClick={() => onChange({ count: item.count + 1 })} aria-label="One more"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
