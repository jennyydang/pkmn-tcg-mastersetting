"use client";

import type { PSM, Worker } from "tesseract.js";
import { ApiError, getCard, getCardsForArtist, getCardsForPokemon, searchCards } from "./api";
import DEX_NAMES from "./dexNames.json";
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

interface Look {
  /** Width to enlarge the crop to. */
  width: number;
  contrast: number;
}
// How a region is prepared for OCR. The first look suits most cards; the others
// help when glare, holo foil or white-on-dark print defeat it.
const LOOKS: Look[] = [
  { width: 1600, contrast: 1.6 },
  { width: 2200, contrast: 1.2 },
  { width: 1400, contrast: 1 },
];

// Tesseract page layouts: "auto" for the name line; "sparse" for the corners,
// where small bits of text (artist, set code, number) sit among artwork and
// sleeve edges. Tested on real photos of sleeved cards, sparse finds the
// number and artist where auto finds nothing.
// (Values of tesseract.js's PSM enum; the module itself loads lazily.)
const PSM_AUTO = "3" as PSM, PSM_SPARSE = "11" as PSM;

/** Crop part of the card (fractions of its width/height), upscale, and adjust contrast for OCR. */
function region(source: HTMLCanvasElement, x: number, y: number, w: number, h: number, look: Look = LOOKS[0]): HTMLCanvasElement {
  const sx = source.width * x, sy = source.height * y, sw = source.width * w, sh = source.height * h;
  const scale = Math.max(1, look.width / sw);
  const out = document.createElement("canvas");
  out.width = Math.round(sw * scale);
  out.height = Math.round(sh * scale);
  const ctx = out.getContext("2d")!;
  // Smooth enlarging keeps small print (number, artist) legible.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `grayscale(1) contrast(${look.contrast})`;
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
  /** Black Star Promo card IDs the number could be ("svp-027"). */
  promoIds?: string[];
  /** Artist from the "Illus." line, to tell apart cards of the same Pokémon. */
  illustrator?: string | null;
  /** Every number that might be the card's, when none came with a "/total". */
  numbers?: string[];
}

// ── Reading names ─────────────────────────────────────────────────────────

const POKEMON_NAMES = new Map(Object.values(DEX_NAMES as Record<string, string>).map((n) => [n.toLowerCase(), n]));

/** Whether two words differ by at most one letter (OCR often misreads one). */
function nearlyEqual(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * A Pokémon's name among the OCR'd words of the top of the card. The top also
 * picks up artwork, sleeve edges and stage text, so rather than trusting the
 * first line, look for a word (or two) that is a real Pokémon name, allowing
 * one misread letter in longer names ("Rikachu").
 */
export function findPokemonName(text: string): string | null {
  // "Evolves from Charmander" names the previous stage, not this card.
  const cleaned = text.replace(/evolves\s+from\s+\S+/gi, " ");
  const words = cleaned.split(/[^A-Za-zÀ-ÿ'.\-♀♂:]+/).map((w) => w.replace(/^['-]+|['-]+$/g, "")).filter((w) => w.length >= 2);
  for (let i = 0; i < words.length; i++) {
    for (const span of [2, 1]) {
      const phrase = words.slice(i, i + span).join(" ").toLowerCase();
      if (phrase.length >= 3 && POKEMON_NAMES.has(phrase)) return POKEMON_NAMES.get(phrase)!;
      const bare = phrase.replace(/[.:]+$/, "");
      if (bare.length >= 3 && POKEMON_NAMES.has(bare)) return POKEMON_NAMES.get(bare)!;
    }
  }
  for (const w of words) {
    if (w.length < 5) continue;
    const lower = w.toLowerCase();
    for (const [key, name] of POKEMON_NAMES) if (!key.includes(" ") && nearlyEqual(lower, key)) return name;
  }
  return null;
}

/** "Illus. Atsushi Furusawa" → "Atsushi Furusawa". */
export function parseIllustrator(text: string): string | null {
  // OCR often drops or misreads the "Il" of "Illus." ("lus.", "Hus").
  const m = /(?:^|[^a-z])(?:i?l+|h)us\.?\s+([A-Za-zÀ-ÿ'.-]+(?:\s+[A-Za-zÀ-ÿ'.-]+){0,2})/i.exec(text);
  if (!m) return null;
  const words = m[1].split(/\s+/).filter((w) => /^[A-Za-zÀ-ÿ'.-]{2,}$/.test(w));
  return words.length ? words.slice(0, 2).join(" ") : null;
}

/**
 * Card numbers printed without a total (promos): three-digit groups, not a ©
 * year. OCR sometimes runs the number into the next mark ("027" → "02748"),
 * so a longer group starting with 0 also offers its first three digits.
 */
export function loneNumbers(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?<![\d©])(\d{3,6})(?!\d)/g)) {
    const digits = m[1];
    if (digits.length === 3) found.add(digits);
    else if (digits.startsWith("0")) found.add(digits.slice(0, 3));
  }
  return [...found];
}

export const loneNumber = (text: string) => loneNumbers(text)[0] ?? null;

/**
 * Whether a card's artist appears in OCR'd text, allowing misreads: some word
 * of 4+ letters shares its first four letters with one of the artist's names
 * ("Furusowo" for Furusawa). Works with or without the "Illus." label.
 */
function sameArtist(read: string, actual: string | undefined) {
  if (!actual) return false;
  const a = read.toLowerCase().split(/[^a-zà-ÿ]+/), b = actual.toLowerCase().split(/[^a-zà-ÿ]+/).filter((x) => x.length >= 4);
  return a.some((w) => w.length >= 4 && b.some((x) => x.slice(0, 4) === w.slice(0, 4)));
}

/**
 * Black Star Promo numbers, which have no "/total": "SVP EN 027" → svp-027,
 * "MEP EN 001" → mep-001, "SWSH001" → swshp-SWSH001, "SM01" → smp-SM01.
 */
export function parsePromo(text: string): string[] {
  const t = text.toUpperCase().replace(/\s+/g, "");
  const ids: string[] = [];
  // OCR puts stray marks between code and number ("SVP: ~ 027"), so allow a few.
  const modern = /(SVP|MEP)[^0-9]{0,6}?(\d{1,3})(?!\d)/.exec(t);
  if (modern) ids.push(`${modern[1].toLowerCase()}-${modern[2].padStart(3, "0")}`);
  const older = /(SWSH|SM|XY|BW)[^0-9A-Z]{0,2}(\d{1,3})(?!\d)/.exec(t);
  if (older) {
    const [, code, digits] = older;
    const set = `${code.toLowerCase()}p`;
    for (const n of new Set([digits, digits.padStart(code === "SWSH" ? 3 : 2, "0")])) ids.push(`${set}-${code}${n}`);
  }
  return ids;
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
  // Generous regions: a card in a sleeve, toploader or binder pocket sits well
  // inside the guide, so its name and number aren't at the very edges. The top
  // quarter holds the name; the bottom fifth the number, set code and artist
  // (number bottom-left on modern cards, bottom-right on older ones).
  // The bottom corners are read separately at a higher zoom: the number and
  // artist are the smallest print on the card.
  const read = async (x: number, y: number, w: number, h: number, psm: PSM, look?: Look) => {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    return (await worker.recognize(region(card, x, y, w, h, look))).data.text;
  };
  // Number, set code and artist sit in the bottom corners: bottom-left on
  // modern cards, bottom-right on older ones.
  const readTop = (look?: Look, psm = PSM_AUTO) => read(0, 0, 1, 0.25, psm, look);
  const readLeft = (look?: Look) => read(0, 0.85, 0.5, 0.14, PSM_SPARSE, look);
  const readRight = (look?: Look) => read(0.5, 0.85, 0.5, 0.14, PSM_SPARSE, look);
  const texts = { top: [await readTop()], left: [await readLeft()], right: [await readRight()] };

  const parse = (): ScanText => {
    const top = texts.top.join("\n"), left = texts.left.join("\n"), bottom = `${left}\n${texts.right.join("\n")}`;
    const number = parseNumber(bottom);
    const promoIds = number ? [] : parsePromo(bottom);
    return {
      name: findPokemonName(top) ?? parseName(texts.top[0]),
      number: number?.number ?? (promoIds.length ? promoIds[0].split("-").pop()!.replace(/^[A-Z]+/, "") : loneNumber(left)),
      numbers: number ? [number.number] : loneNumbers(bottom),
      total: number?.total ?? null,
      raw: `${top}\n${bottom}`.trim(),
      bottom,
      promoIds,
      illustrator: parseIllustrator(bottom),
    };
  };

  // Missing the name, or both number and artist? Look again with other
  // settings and read everything together.
  let scan = parse();
  for (const look of LOOKS.slice(1)) {
    const knownName = scan.name && POKEMON_NAMES.has(scan.name.toLowerCase());
    if (knownName && (scan.number || scan.illustrator)) break;
    if (!knownName) texts.top.push(await readTop(look, PSM_SPARSE));
    if (!scan.number || !scan.illustrator) {
      texts.left.push(await readLeft(look));
      if (!scan.number) texts.right.push(await readRight(look));
    }
    scan = parse();
  }
  return scan;
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

  // Promos: the code and number are the card's ID.
  for (const id of scan.promoIds ?? []) {
    const card = await getCard(id).catch((e) => { if (!(e instanceof ApiError)) throw e; return null; });
    if (card && (!scan.name || nameMatches(card.name, scan.name))) return [card];
  }

  // A Pokémon's whole card list narrows fastest: by number if one was read
  // (no total, e.g. a promo misread), else by artist.
  if (scan.name && POKEMON_NAMES.has(scan.name.toLowerCase())) {
    const all = await getCardsForPokemon(scan.name).catch(() => []);
    const numbers = new Set((scan.numbers?.length ? scan.numbers : scan.number ? [scan.number] : []).map(normalize));
    const byNumber = all.filter((c) => numbers.has(normalize(c.number)));
    const pool = byNumber.length ? byNumber : all;
    // The artist, from the "Illus." line or anywhere in the bottom text.
    const artistText = `${scan.illustrator ?? ""} ${scan.bottom ?? ""}`;
    const byArtist = pool.filter((c) => sameArtist(artistText, c.illustrator));
    const hasTotal = !!(scan.total && /^\d+$/.test(scan.total)); // then the number search below is exact
    if (byNumber.length && !hasTotal) return (byArtist.length ? byArtist : byNumber).reverse();
    if (!hasTotal && byArtist.length) return byArtist.reverse();
  }

  // No name, but a number and artist: the artist's cards with that number.
  const artistWord = scan.illustrator?.split(/\s+/).find((w) => w.length >= 4);
  if (!scan.name && scan.number && artistWord) {
    const theirs = (await getCardsForArtist(artistWord).catch(() => [])).filter((c) => normalize(c.number) === normalize(scan.number!));
    if (theirs.length) return theirs.reverse();
  }

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

const normalize = (n: string) => n.toUpperCase().replace(/^([A-Z]*)0*(?=\d)/, "$1");

/** The one card a scan clearly points to, if any: the only candidate, or the only one whose name matches a read number. */
export function confidentMatch(scan: ScanText, candidates: PokemonCard[]): PokemonCard | null {
  if (candidates.length === 1) return candidates[0];
  const named = scan.name ? candidates.filter((c) => nameMatches(c.name, scan.name!)) : [];
  return scan.number && named.length === 1 ? named[0] : null;
}
