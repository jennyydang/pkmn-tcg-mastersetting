import { supabase } from "./supabase";
import { getCardsForSet, getSetCatalog, normalizeNumber } from "./api";
import { legacySetToTcgdex } from "./legacyIds";
import { parseOwnedKey } from "./variants";
import { CustomCardDef, PokemonCard, TrackedMasterSet } from "./types";

// One-time conversion of saved pokemontcg.io IDs ("sv3pt5-25", set "sv3pt5") to
// TCGdex IDs ("sv03.5-025", set "sv03.5"). New rows are written before old ones are
// deleted, IDs that can't be matched are left as they are, and re-running is safe,
// so a failure part-way just means it tries again on the next load.

const doneKey = (userId: string) => `pkmn-tcgdex-ids-v1:${userId}`;

export interface SavedData {
  items: TrackedMasterSet[];
  collection: string[];
}

function uniqueBy<T>(list: T[], key: (x: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const x of list) if (!seen.has(key(x))) seen.set(key(x), x);
  return [...seen.values()];
}

function chunks<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const LEGACY_IMAGE = /^https:\/\/images\.pokemontcg\.io\/([^/]+)\/([^/_.]+)(?:_hires)?\.png$/;

export async function migrateToTcgdexIds(userId: string, data: SavedData): Promise<SavedData> {
  try {
    if (localStorage.getItem(doneKey(userId))) return data;
  } catch {}

  const catalog = await getSetCatalog();

  const setCards = new Map<string, Promise<PokemonCard[]>>();
  function cardsOf(setId: string) {
    if (!setCards.has(setId)) setCards.set(setId, getCardsForSet(setId));
    return setCards.get(setId)!;
  }

  async function resolveCard(id: string): Promise<PokemonCard | null> {
    // Already a TCGdex ID? Set IDs can contain "-" ("tk-xy-n-1"), so try each split.
    for (let i = id.lastIndexOf("-"); i > 0; i = id.lastIndexOf("-", i - 1)) {
      const setId = id.slice(0, i);
      if (!catalog.has(setId)) continue;
      const card = (await cardsOf(setId)).find((c) => c.id === id);
      if (card) return card;
    }
    // pokemontcg.io IDs are "<set>-<number>" with no "-" in the set ID.
    const dash = id.indexOf("-");
    if (dash < 0) return null;
    const setId = legacySetToTcgdex(id.slice(0, dash));
    if (!setId || !catalog.has(setId)) return null;
    const num = normalizeNumber(id.slice(dash + 1));
    return (await cardsOf(setId)).find((c) => normalizeNumber(c.number) === num) ?? null;
  }

  function resolveSetId(id: string): string {
    if (catalog.has(id)) return id;
    const mapped = legacySetToTcgdex(id);
    return mapped && catalog.has(mapped) ? mapped : id;
  }

  // ── Resolve every saved card ID (unmatched IDs map to themselves) ─────────
  const allIds = new Set<string>(data.collection);
  for (const item of data.items) {
    item.ownedCards.forEach((key) => allIds.add(parseOwnedKey(key).cardId));
    item.customCards?.forEach((c) => allIds.add(c.id));
  }
  const imageCardIds = new Map<string, string>(); // legacy image URL → legacy card ID
  for (const url of [...data.items.map((t) => t.image), ...data.items.flatMap((t) => t.customCards?.map((c) => c.imageSmall) ?? [])]) {
    const m = url && LEGACY_IMAGE.exec(url);
    if (m && m[2] !== "logo" && m[2] !== "symbol") imageCardIds.set(url, `${m[1]}-${m[2]}`);
  }
  imageCardIds.forEach((id) => allIds.add(id));

  const resolved = new Map<string, PokemonCard>();
  await Promise.all([...allIds].map(async (id) => {
    const card = await resolveCard(id);
    if (card) resolved.set(id, card);
  }));
  // Owned entries may name a version ("<card id>|reverse"); convert the card part only.
  const newCardId = (key: string) => {
    const { cardId, variant } = parseOwnedKey(key);
    const id = resolved.get(cardId)?.id ?? cardId;
    return variant ? `${id}|${variant}` : id;
  };

  function newImage(item: { type?: string; id?: string; image: string }): string {
    if (!item.image?.startsWith("https://images.pokemontcg.io/")) return item.image;
    if (item.type === "set") {
      const set = catalog.get(resolveSetId(item.id!));
      return set ? set.images.logo || set.images.symbol || item.image : item.image;
    }
    const legacyId = imageCardIds.get(item.image);
    return (legacyId && resolved.get(legacyId)?.images.small) || item.image;
  }

  // ── Build the converted data ───────────────────────────────────────────────
  const mapped: TrackedMasterSet[] = data.items.map((t) => ({
    ...t,
    id:          t.type === "set" ? resolveSetId(t.id) : t.id,
    image:       newImage(t),
    ownedCards:  [...new Set(t.ownedCards.map(newCardId))],
    customCards: t.customCards?.map((c): CustomCardDef => ({
      ...c,
      id:         newCardId(c.id),
      imageSmall: newImage({ image: c.imageSmall }),
    })),
  }));
  // A retry after a half-finished run can hold both the old and new copy of a set;
  // merge them so each ID appears once.
  const byId = new Map<string, TrackedMasterSet>();
  for (const t of mapped) {
    const prev = byId.get(t.id);
    byId.set(t.id, prev ? { ...prev, ownedCards: [...new Set([...prev.ownedCards, ...t.ownedCards])] } : t);
  }
  const items = [...byId.values()];
  const collection = [...new Set(data.collection.map(newCardId))];

  // ── Work out which rows change ─────────────────────────────────────────────
  const renamedItems   = data.items.map((t, i) => ({ old: t, next: mapped[i], index: i })).filter(({ old, next }) => old.id !== next.id);
  const imageOnlyItems = data.items.map((t, i) => ({ old: t, next: mapped[i] })).filter(({ old, next }) => old.id === next.id && old.image !== next.image);

  const ownedInserts: { user_id: string; item_id: string; card_id: string }[] = [];
  const ownedDeletes: { itemId: string; cardIds: string[] }[] = [];
  const customInserts: Record<string, string>[] = [];
  const customDeletes: { itemId: string; cardIds: string[] }[] = [];
  data.items.forEach((old, i) => {
    const next = mapped[i];
    const renamed = old.id !== next.id;
    const changedOwned = old.ownedCards.filter((id) => renamed || newCardId(id) !== id);
    for (const id of changedOwned) ownedInserts.push({ user_id: userId, item_id: next.id, card_id: newCardId(id) });
    if (changedOwned.length) ownedDeletes.push({ itemId: old.id, cardIds: changedOwned });

    const changedCustom = (old.customCards ?? []).filter((c, j) => c.id !== next.customCards![j].id || c.imageSmall !== next.customCards![j].imageSmall);
    for (const c of changedCustom) {
      const n = next.customCards![old.customCards!.indexOf(c)];
      customInserts.push({ user_id: userId, item_id: old.id, card_id: n.id, card_name: n.name, card_image_small: n.imageSmall, card_set_name: n.setName });
    }
    const movedCustom = changedCustom.filter((c) => newCardId(c.id) !== c.id).map((c) => c.id);
    if (movedCustom.length) customDeletes.push({ itemId: old.id, cardIds: movedCustom });
  });
  const changedCollection = data.collection.filter((id) => newCardId(id) !== id);

  const nothingToDo =
    !renamedItems.length && !imageOnlyItems.length && !ownedInserts.length && !customInserts.length && !changedCollection.length;

  if (!nothingToDo) {
    // 1. Write all new rows. Any failure stops here with old data intact.
    const writes = [
      ...uniqueBy(renamedItems, ({ next }) => next.id).map(({ old, next, index }) =>
        supabase.from("tracked_master_sets").upsert({
          user_id: userId, item_id: next.id, type: next.type, label: next.label, image: next.image,
          total_cards: old.totalCards, subtitle: next.subtitle ?? null, sort_order: index,
        }, { onConflict: "user_id,item_id" })),
      ...imageOnlyItems.map(({ next }) =>
        supabase.from("tracked_master_sets").update({ image: next.image }).eq("user_id", userId).eq("item_id", next.id)),
      ...chunks(uniqueBy(ownedInserts, (r) => `${r.item_id} ${r.card_id}`)).map((rows) =>
        supabase.from("owned_cards").upsert(rows, { onConflict: "user_id,item_id,card_id", ignoreDuplicates: true })),
      ...chunks(uniqueBy(customInserts, (r) => `${r.item_id} ${r.card_id}`)).map((rows) =>
        supabase.from("custom_set_cards").upsert(rows, { onConflict: "user_id,item_id,card_id" })),
      ...chunks(changedCollection).map((ids) =>
        supabase.from("collection_cards").upsert(
          uniqueBy(ids.map((id) => ({ user_id: userId, card_id: newCardId(id) })), (r) => r.card_id),
          { onConflict: "user_id,card_id", ignoreDuplicates: true })),
    ];
    const writeErrors = (await Promise.all(writes)).map((r) => r.error).filter(Boolean);
    if (writeErrors.length) {
      console.error("TCGdex ID migration: write failed, keeping old IDs", writeErrors[0]);
      return data;
    }

    // 2. Remove the old rows.
    const deletes = [
      ...ownedDeletes.flatMap(({ itemId, cardIds }) => chunks(cardIds).map((ids) =>
        supabase.from("owned_cards").delete().eq("user_id", userId).eq("item_id", itemId).in("card_id", ids))),
      ...customDeletes.flatMap(({ itemId, cardIds }) => chunks(cardIds).map((ids) =>
        supabase.from("custom_set_cards").delete().eq("user_id", userId).eq("item_id", itemId).in("card_id", ids))),
      ...chunks(changedCollection).map((ids) =>
        supabase.from("collection_cards").delete().eq("user_id", userId).in("card_id", ids)),
      ...(renamedItems.length
        ? [supabase.from("tracked_master_sets").delete().eq("user_id", userId).in("item_id", renamedItems.map(({ old }) => old.id))]
        : []),
    ];
    const deleteErrors = (await Promise.all(deletes)).map((r) => r.error).filter(Boolean);
    if (deleteErrors.length) {
      // New rows are in place; leave the flag unset so the next load finishes the cleanup.
      console.error("TCGdex ID migration: cleanup failed, will retry", deleteErrors[0]);
      return { items, collection };
    }
  }

  try {
    localStorage.setItem(doneKey(userId), "1");
  } catch {}
  return { items, collection };
}
