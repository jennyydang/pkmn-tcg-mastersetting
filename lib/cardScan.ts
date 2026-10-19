"use client";

import type { Worker } from "tesseract.js";
import { searchCards } from "./api";
import { jaSetBeforeNumber, searchJaByNumber } from "./japanese";
import { PokemonCard } from "./types";

// Reads a photo of a card on the device (Tesseract OCR, bundled in public/ocr
// by scripts/copy-ocr-assets.mjs, so it works offline and costs nothing) and
// finds matching cards. The printed number with the set size ("025/165") is
// the strongest clue; the name at the top breaks ties or stands in when the
// number can't be read.

let workerPromise: Promise<Worker> | null = null;

/** Start the OCR engine (loads ~15 MB once); safe to call early to warm it up. */
export function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    const base = `${window.location.origin}/ocr`;
    workerPromise = import("tesseract.js")
      .then(({ createWorker }) => createWorker("eng", 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: base,
        langPath: base,
        gzip: true,
      }));
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

/** Crop part of the card (fractions of its width/height), upscale, and boost contrast for OCR. */
function region(source: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const sx = source.width * x, sy = source.height * y, sw = source.width * w, sh = source.height * h;
  const scale = Math.max(1, 1400 / sw);
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const ctx = out.getContext("2d")!;
  ctx.filter = "grayscale(1) contrast(1.6)";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

export interface ScanText {
  name: string | null;
  number: string | null;
  total: string | null;
  raw: string;
  /** Text of the bottom strip, where the set code is printed. */
  bottom?: string;
}

/** Card name: the first line with real words, minus HP / stage / evolution noise. */
export function parseName(text: string): string | null {
  for (const line of text.split("\n")) {
    const cleaned = line
      .replace(/\b(BASIC|STAGE\s*\d|STAGE|H[PF]|EVOLVES FROM.*)\b/gi, " ")
      .replace(/[^A-Za-zÀ-ÿ'’.\- ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = cleaned.split(" ").filter((w) => w.length >= 2);
    if (words.join("").length >= 3) return words.slice(0, 4).join(" ");
  }
  return null;
}

/**
 * Collector number like "025/165", "TG05/TG30" or "SV001/SV122"; O/Q and I/L
 * next to digits are read as 0 and 1. Letters before the number only count when
 * the total has the same prefix, so a set code printed beside it ("MEW EN
 * 025/165", read as "MEWEN025/165") isn't mistaken for part of the number.
 */
export function parseNumber(text: string): { number: string; total: string } | null {
  const fixed = text.toUpperCase().replace(/(?<=\d)[OQ]|[OQ](?=\d)/g, "0").replace(/(?<=\d)[IL]|[IL](?=\d)/g, "1");
  const m = /([A-Z]*)(\d{1,3})\s*\/\s*([A-Z]{0,4})(\d{1,3})/.exec(fixed);
  if (!m) return null;
  const [, before, digits, totalPrefix, totalDigits] = m;
  const number = totalPrefix && before.endsWith(totalPrefix) ? totalPrefix + digits : digits;
  return { number, total: totalPrefix + totalDigits };
}

// The OCR worker reads one card at a time (each read changes its settings), so
// cards scanned quickly in a row wait their turn.
let queue: Promise<unknown> = Promise.resolve();

/** OCR the name strip (top) and number strip (bottom) of a card photo. */
export function readCard(card: HTMLCanvasElement): Promise<ScanText> {
  const result = queue.then(() => readCardNow(card));
  queue = result.catch(() => {});
  return result;
}

async function readCardNow(card: HTMLCanvasElement): Promise<ScanText> {
  const worker = await getOcrWorker();
  await worker.setParameters({ tessedit_char_whitelist: "" });
  const top = await worker.recognize(region(card, 0.04, 0.02, 0.8, 0.1));
  // Lowercase too: Japanese set codes mix cases ("SV2a").
  await worker.setParameters({ tessedit_char_whitelist: "0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" });
  // Number sits bottom-left on modern cards and bottom-right on older ones: read the whole strip.
  const bottom = await worker.recognize(region(card, 0.02, 0.86, 0.96, 0.12));
  const number = parseNumber(bottom.data.text);
  return {
    name: parseName(top.data.text),
    number: number?.number ?? null,
    total: number?.total ?? null,
    raw: `${top.data.text}\n${bottom.data.text}`.trim(),
    bottom: bottom.data.text,
  };
}

/** Whether a card name matches what OCR read, word by word (OCR adds stray words like "HF"). */
export function nameMatches(cardName: string, read: string) {
  const name = cardName.toLowerCase();
  return read.toLowerCase().split(/[^a-zà-ÿ0-9]+/).some((w) => w.length >= 3 && name.includes(w));
}
const similar = nameMatches;

/**
 * A Japanese card: modern ones print the set code beside the number ("SV2a
 * 025/165") and no language code, where English ones print e.g. "MEW EN".
 * The code and number pin down the card even though the Japanese name can't
 * be read.
 */
async function findJapanese(scan: ScanText): Promise<PokemonCard[]> {
  if (!scan.number || !scan.bottom) return [];
  const set = await jaSetBeforeNumber(scan.bottom).catch(() => undefined);
  if (!set) return [];
  const cards = await searchJaByNumber(scan.number).catch(() => []);
  return cards.filter((c) => c.set.id === set.id);
}

/** Cards matching what was read, best first. */
export async function findCandidates(scan: ScanText): Promise<PokemonCard[]> {
  const japanese = await findJapanese(scan);
  if (japanese.length) return japanese;

  const byName = (cards: PokemonCard[]) =>
    scan.name ? [...cards].sort((a, b) => Number(similar(b.name, scan.name!)) - Number(similar(a.name, scan.name!))) : cards;

  if (scan.number && scan.total && /^\d+$/.test(scan.total)) {
    const exact = await searchCards(`${scan.number}/${scan.total}`).catch(() => []);
    if (exact.length) return byName(exact);
  }
  if (scan.number) {
    const byNumber = (await searchCards(scan.number).catch(() => [])).filter((c) => !scan.name || similar(c.name, scan.name));
    if (byNumber.length) return byNumber;
  }
  if (scan.name) return searchCards(scan.name).catch(() => []);
  return [];
}

/** The one card a scan clearly points to, if any: the only candidate, or the only one whose name matches a read number. */
export function confidentMatch(scan: ScanText, candidates: PokemonCard[]): PokemonCard | null {
  if (candidates.length === 1) return candidates[0];
  const named = scan.name ? candidates.filter((c) => nameMatches(c.name, scan.name!)) : [];
  return scan.number && named.length === 1 ? named[0] : null;
}
