"use client";

import { siteUrl, APP_NAME } from "./appInfo";
import { CONDITIONS, Condition, CopyDetails } from "./cardData";
import { conditionPrice } from "./conditions";
import { PokemonCard } from "./types";
import { VARIANT_LABELS, cardVariants, parseOwnedKey, variantPrice } from "./variants";

// Extras: copies beyond the one you keep, offered for trade. A trade list is
// shared as a link (the list lives in the URL, so no account or server is
// needed to view it), as text, or as an image.

export interface TradeEntry {
  /** Owned key: "<card id>" or "<card id>|<variant>". */
  key: string;
  count: number;
  /** The copy's condition ("LP") or grade ("PSA 9"), if set. */
  note?: string;
}

export interface TradeRow extends TradeEntry {
  card: PokemonCard;
  /** Price of one copy: the market price, adjusted for condition when known. */
  price?: number;
  /** Graded copies sell for more; the price shown is for an ungraded card. */
  graded: boolean;
}

const isCondition = (note: string | undefined): note is Condition => CONDITIONS.some((c) => c.value === note);

/** Extras from saved copy counts: everything past the first copy of each version. */
export function extrasFromDetails(details: Map<string, CopyDetails>): TradeEntry[] {
  return [...details].filter(([, d]) => d.quantity > 1).map(([key, d]) => ({
    key,
    count: d.quantity - 1,
    note: d.gradeCompany ? `${d.gradeCompany} ${d.grade ?? ""}`.trim() : d.condition ?? undefined,
  }));
}

export function tradeRows(entries: TradeEntry[], cards: Map<string, PokemonCard>): TradeRow[] {
  return entries.flatMap((e) => {
    const { cardId, variant } = parseOwnedKey(e.key);
    const card = cards.get(cardId);
    if (!card) return [];
    const market = variantPrice(card, variant);
    const price = market != null && isCondition(e.note) ? conditionPrice(market, e.note) : market;
    return [{ ...e, card, price, graded: !!e.note && !isCondition(e.note) }];
  });
}

/** "Reverse Holo", "PSA 10", "LP" … whatever distinguishes this copy. */
export function rowLabel(row: TradeRow): string {
  const { variant } = parseOwnedKey(row.key);
  const parts: string[] = [];
  if (variant && cardVariants(row.card).length > 1) parts.push(VARIANT_LABELS[variant].long);
  if (row.note) parts.push(row.note);
  return parts.join(" · ");
}

// ── Links ────────────────────────────────────────────────────────────────

// Each entry is "<key>[*<count>][~<note>]", comma-separated, e.g. "sv03.5-025*2~LP".
export function encodeTradeList(entries: TradeEntry[]): string {
  return entries.map((e) => `${e.key}${e.count > 1 ? `*${e.count}` : ""}${e.note ? `~${e.note.replace(/[,~*]/g, " ")}` : ""}`).join(",");
}

export function decodeTradeList(text: string): TradeEntry[] {
  return text.split(",").flatMap((part) => {
    const [main, note] = part.split("~");
    const [key, n] = main.split("*");
    const count = n ? parseInt(n, 10) : 1;
    return key && count > 0 && count < 1000 ? [{ key, count, note: note?.trim().slice(0, 20) || undefined }] : [];
  });
}

export function tradeListUrl(entries: TradeEntry[]) {
  return `${siteUrl()}/trade?l=${encodeURIComponent(encodeTradeList(entries))}`;
}

// ── Text ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export function tradeListText(rows: TradeRow[], url: string) {
  const lines = rows.map((r) => {
    const label = rowLabel(r);
    return `${r.count}× ${r.card.name}${label ? ` (${label})` : ""} · ${r.card.set.name} #${r.card.number}${r.price != null ? ` · ${fmt(r.price)}${r.graded ? " ungraded" : ""}` : ""}`;
  });
  return `My trade list:\n${lines.join("\n")}\n\n${url}`;
}

// ── Image ────────────────────────────────────────────────────────────────

const MAX_IMAGE_CARDS = 24;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // so the canvas can still be exported
    const timer = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

/** A shareable picture of the list: a grid of cards with counts and prices. */
export async function tradeListImage(rows: TradeRow[]): Promise<Blob> {
  const shown = rows.slice(0, MAX_IMAGE_CARDS);
  const W = 1080, pad = 48, gap = 24, cols = 4;
  const cardW = (W - pad * 2 - gap * (cols - 1)) / cols, cardH = cardW * (88 / 63), textH = 92;
  const header = 180, footer = rows.length > shown.length ? 110 : 80;
  const H = header + Math.ceil(shown.length / cols) * (cardH + textH + gap) + footer;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const font = (size: number, weight = 400) => `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const total = rows.reduce((n, r) => n + r.count, 0);
  const value = rows.reduce((sum, r) => sum + (r.price ?? 0) * r.count, 0);
  ctx.fillStyle = "#111827";
  ctx.font = font(52, 700);
  ctx.fillText("Trade list", pad, pad + 48);
  ctx.fillStyle = "#6b7280";
  ctx.font = font(28);
  ctx.fillText(`${total} ${total === 1 ? "card" : "cards"}${value > 0 ? ` · about ${fmt(value)}` : ""}`, pad, pad + 92);

  const images = await Promise.all(shown.map((r) => loadImage(r.card.images.small)));
  shown.forEach((r, i) => {
    const x = pad + (i % cols) * (cardW + gap);
    const y = header + Math.floor(i / cols) * (cardH + textH + gap);
    const img = images[i];
    if (img) {
      ctx.drawImage(img, x, y, cardW, cardH);
    } else {
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(x, y, cardW, cardH);
      ctx.fillStyle = "#9ca3af";
      ctx.font = font(22, 600);
      ctx.fillText(fitText(ctx, r.card.name, cardW - 24), x + 12, y + cardH / 2);
    }
    if (r.count > 1) {
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(x + cardW - 26, y + 26, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = font(22, 700);
      ctx.textAlign = "center";
      ctx.fillText(`×${r.count}`, x + cardW - 26, y + 34);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#111827";
    ctx.font = font(24, 600);
    ctx.fillText(fitText(ctx, r.card.name, cardW), x, y + cardH + 32);
    ctx.fillStyle = "#6b7280";
    ctx.font = font(20);
    const label = rowLabel(r);
    ctx.fillText(fitText(ctx, label || `${r.card.set.name} #${r.card.number}`, cardW), x, y + cardH + 58);
    if (r.price != null) {
      ctx.fillStyle = "#111827";
      ctx.font = font(20, 600);
      ctx.fillText(`${fmt(r.price)}${r.graded ? " raw" : ""}`, x, y + cardH + 84);
    }
  });

  ctx.fillStyle = "#9ca3af";
  ctx.font = font(24);
  if (rows.length > shown.length) ctx.fillText(`and ${rows.length - shown.length} more…`, pad, H - 70);
  ctx.textAlign = "right";
  ctx.fillText(APP_NAME, W - pad, H - 32);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create image"))), "image/png"));
}
