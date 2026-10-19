"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { CustomCardDef, TrackedMasterSet } from "./types";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { migrateToTcgdexIds } from "./migrateIds";
import { WriteOp, flushQueue, isNetworkError, writeOrQueue } from "./syncQueue";
import { isOnline } from "./online";
import { parseOwnedKey } from "./variants";
import { useOnRefresh } from "./refresh";

const STORAGE_KEY = "pkmn-tcg-mastersetting-v3";
const COLLECTION_KEY = "pkmn-tcg-collection-v1";

interface StoreContextValue {
  trackedItems:        TrackedMasterSet[];
  addItem:             (item: TrackedMasterSet) => void;
  removeItem:          (id: string) => void;
  toggleCard:          (id: string, cardId: string) => void;
  isCardOwned:         (id: string, cardId: string) => boolean;
  hasItem:             (id: string) => boolean;
  updateTotal:         (id: string, total: number) => void;
  reorderItems:        (fromId: string, toId: string) => void;
  addCustomCard:       (itemId: string, card: CustomCardDef) => void;
  removeCustomCard:    (itemId: string, cardId: string) => void;
  updateItem:          (id: string, updates: { label?: string; subtitle?: string; image?: string }) => void;
  collectionCardIds:   string[];
  addCollectionCard:   (cardId: string) => void;
  removeCollectionCard:(cardId: string) => void;
  isInCollection:      (cardId: string) => boolean;
  syncError:           string | null;
  clearSyncError:      () => void;
  /** Show a load/save problem in the banner (used by lib/cardData.tsx). */
  reportSyncError:     (message: string) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  // Supabase hands out a new user object on every token refresh and tab refocus;
  // key on the ID so those don't trigger a reload that can clobber unsaved changes.
  const userId = user?.id;
  const [trackedItems, setTrackedItems]           = useState<TrackedMasterSet[]>([]);
  const [collectionCardIds, setCollectionCardIds] = useState<string[]>([]);
  const [hydrated, setHydrated]                   = useState(false);
  const [syncError, setSyncError]                 = useState<string | null>(null);
  // Bumped to reload from Supabase (e.g. when the connection comes back).
  const [reloadToken, setReloadToken]             = useState(0);
  // Only write to Supabase after we've confirmed the full server-state for this user.
  const loadedForUser = useRef<string | null>(null);
  // Pull-to-refresh waits on these; called when the next load finishes.
  const loadWaiters = useRef<(() => void)[]>([]);

  // ── 1. Hydrate from localStorage immediately for a fast first paint ──────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrackedItems(JSON.parse(raw));
    } catch {}
    try {
      const rawCol = localStorage.getItem(COLLECTION_KEY);
      if (rawCol) setCollectionCardIds(JSON.parse(rawCol));
    } catch {}
    setHydrated(true);
  }, []);

  // ── 2. Load from Supabase when the authenticated user changes ────────────
  useEffect(() => {
    // Wait for auth to resolve: user is null until then, and treating that as a
    // sign-out would wipe the cached data.
    if (authLoading) return;
    if (!userId) {
      setTrackedItems([]);
      setCollectionCardIds([]);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(COLLECTION_KEY);
      // Want list / copy details kept for offline use (lib/cardData.tsx). Queued
      // unsynced changes stay, and are sent when that user signs back in.
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("pocketi-carddata:")) localStorage.removeItem(key);
      }
      loadedForUser.current = null;
      return;
    }

    async function loadFromSupabase() {
      // Send changes made offline first, so what we load includes them.
      if (isOnline()) {
        const rejected = await flushQueue(userId!);
        if (rejected.length) reportWriteError("queued saves", rejected[0]);
      }

      const [
        { data: sets, error: setsErr },
        { data: cards, error: cardsErr },
        { data: customCards, error: customErr },
        { data: colCards, error: colErr },
      ] = await Promise.all([
        supabase
          .from("tracked_master_sets")
          .select("item_id, type, label, image, total_cards, subtitle, sort_order")
          .eq("user_id", userId!)
          .order("sort_order", { ascending: true }),
        supabase
          .from("owned_cards")
          .select("item_id, card_id")
          .eq("user_id", userId!),
        supabase
          .from("custom_set_cards")
          .select("item_id, card_id, card_name, card_image_small, card_set_name")
          .eq("user_id", userId!),
        supabase
          .from("collection_cards")
          .select("card_id")
          .eq("user_id", userId!),
      ]);

      if (setsErr || cardsErr || customErr) {
        const err = setsErr ?? cardsErr ?? customErr;
        // Offline: keep the copy saved on this device and let changes queue; the
        // "online" listener below reloads once the connection is back.
        if (isNetworkError(err)) {
          loadedForUser.current = userId!;
          return;
        }
        console.error("Supabase load error", err);
        setSyncError("Couldn't load your saved data, so changes won't be saved. Refresh to try again.");
        return;
      }
      // My Collection lives in its own table; if it can't load, keep the rest working.
      if (colErr && !isNetworkError(colErr)) {
        console.error("Supabase load error (collection_cards)", colErr);
        setSyncError(`Couldn't load My Collection (${colErr.message}). Your master sets are unaffected.`);
      }

      const cardsByItem = new Map<string, string[]>();
      for (const row of cards ?? []) {
        const list = cardsByItem.get(row.item_id) ?? [];
        list.push(row.card_id);
        cardsByItem.set(row.item_id, list);
      }

      const customByItem = new Map<string, CustomCardDef[]>();
      for (const row of customCards ?? []) {
        const list = customByItem.get(row.item_id) ?? [];
        list.push({ id: row.card_id, name: row.card_name, imageSmall: row.card_image_small, setName: row.card_set_name });
        customByItem.set(row.item_id, list);
      }

      const loaded: TrackedMasterSet[] = (sets ?? []).map((row) => ({
        type:        row.type as "pokemon" | "set" | "artist" | "custom",
        id:          row.item_id,
        label:       row.label,
        image:       row.image,
        totalCards:  row.total_cards,
        subtitle:    row.subtitle ?? undefined,
        ownedCards:  cardsByItem.get(row.item_id) ?? [],
        customCards: customByItem.get(row.item_id),
      }));

      // Convert IDs saved under pokemontcg.io to TCGdex (no-op once done). If TCGdex
      // is unreachable, carry on with the saved IDs and try again next load.
      let data = { items: loaded, collection: colErr ? [] : (colCards ?? []).map((r) => r.card_id) };
      try {
        data = await migrateToTcgdexIds(userId!, data);
      } catch (e) {
        console.error("TCGdex ID migration failed", e);
      }

      setTrackedItems(data.items);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.items));
      if (!colErr) {
        setCollectionCardIds(data.collection);
        localStorage.setItem(COLLECTION_KEY, JSON.stringify(data.collection));
      }
      loadedForUser.current = userId!;
    }

    loadFromSupabase().finally(() => loadWaiters.current.splice(0).forEach((done) => done()));
  }, [userId, authLoading, reloadToken]);

  useOnRefresh(() => {
    if (!userId) return;
    const loaded = new Promise<void>((resolve) => loadWaiters.current.push(resolve));
    setReloadToken((n) => n + 1);
    return loaded;
  });

  // Back online: sync queued changes, then reload so this device matches the server.
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => setReloadToken((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId]);

  // ── 3. Keep trackedItems in localStorage in sync ─────────────────────────
  useEffect(() => {
    if (hydrated && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedItems));
    }
  }, [trackedItems, hydrated, user]);

  // ── 4. Keep collectionCardIds in localStorage in sync ────────────────────
  useEffect(() => {
    if (hydrated && user) {
      localStorage.setItem(COLLECTION_KEY, JSON.stringify(collectionCardIds));
    }
  }, [collectionCardIds, hydrated, user]);

  function reportWriteError(label: string, error: { message: string }) {
    console.error(label, error);
    setSyncError(`Couldn't save your change (${error.message}). Refresh to see what's saved.`);
  }

  // Guard: only write to Supabase once the load for this user completed.
  function canWrite(uid: string | undefined): uid is string {
    return !!uid && loadedForUser.current === uid;
  }

  // Save a change, or queue it to sync later when offline (lib/syncQueue.ts).
  function persist(label: string, op: WriteOp) {
    const uid = user?.id;
    if (!canWrite(uid)) return;
    writeOrQueue(uid, label, op).then((error) => { if (error) reportWriteError(label, error); });
  }

  // ── Mutations (optimistic local-first, Supabase in background) ───────────

  function addItem(item: TrackedMasterSet) {
    setTrackedItems((prev) => {
      if (prev.some((t) => t.id === item.id)) return prev;
      const next = [...prev, item];
      if (user) {
        persist("addItem", { kind: "upsert", table: "tracked_master_sets", onConflict: "user_id,item_id", rows: {
          user_id:     user.id,
          item_id:     item.id,
          type:        item.type,
          label:       item.label,
          image:       item.image,
          total_cards: item.totalCards,
          subtitle:    item.subtitle ?? null,
          sort_order:  next.length - 1,
        } });
      }
      return next;
    });
  }

  function removeItem(id: string) {
    setTrackedItems((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (user) {
        for (const table of ["owned_cards", "custom_set_cards", "tracked_master_sets"]) {
          persist(`removeItem ${table}`, { kind: "delete", table, match: { user_id: user.id, item_id: id } });
        }
      }
      return next;
    });
  }

  function toggleCard(id: string, cardId: string) {
    // Checking a card in any master set also puts it in My Collection. Unchecking
    // leaves it there: you may still own it, and it can be removed from Collection.
    if (!isCardOwned(id, cardId)) addCollectionCard(parseOwnedKey(cardId).cardId);
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const wasOwned = t.ownedCards.includes(cardId);
        const ownedCards = wasOwned
          ? t.ownedCards.filter((c) => c !== cardId)
          : [...t.ownedCards, cardId];

        if (user) {
          if (!wasOwned) {
            persist("toggleCard insert", { kind: "upsert", table: "owned_cards", onConflict: "user_id,item_id,card_id", ignoreDuplicates: true,
              rows: { user_id: user.id, item_id: id, card_id: cardId } });
          } else {
            persist("toggleCard delete", { kind: "delete", table: "owned_cards", match: { user_id: user.id, item_id: id, card_id: cardId } });
          }
        }

        return { ...t, ownedCards };
      })
    );
  }

  function isCardOwned(id: string, cardId: string) {
    return trackedItems.find((t) => t.id === id)?.ownedCards.includes(cardId) ?? false;
  }

  function hasItem(id: string) {
    return trackedItems.some((t) => t.id === id);
  }

  function updateTotal(id: string, total: number) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.totalCards === total) return t;
        if (user) {
          persist("updateTotal", { kind: "update", table: "tracked_master_sets", values: { total_cards: total }, match: { user_id: user.id, item_id: id } });
        }
        return { ...t, totalCards: total };
      })
    );
  }

  function reorderItems(fromId: string, toId: string) {
    setTrackedItems((prev) => {
      const from = prev.findIndex((t) => t.id === fromId);
      const to   = prev.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);

      if (user) {
        const rows = next.map((t, index) => ({
          user_id:     user.id,
          item_id:     t.id,
          type:        t.type,
          label:       t.label,
          image:       t.image,
          total_cards: t.totalCards,
          subtitle:    t.subtitle ?? null,
          sort_order:  index,
        }));
        persist("reorderItems", { kind: "upsert", table: "tracked_master_sets", onConflict: "user_id,item_id", rows });
      }

      return next;
    });
  }

  function addCustomCard(itemId: string, card: CustomCardDef) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== itemId || t.type !== "custom") return t;
        if ((t.customCards ?? []).some((c) => c.id === card.id)) return t;
        const customCards = [...(t.customCards ?? []), card];
        const totalCards  = customCards.length;
        const image       = t.image || card.imageSmall;
        if (user) {
          persist("addCustomCard", { kind: "upsert", table: "custom_set_cards", onConflict: "user_id,item_id,card_id", ignoreDuplicates: true,
            rows: { user_id: user.id, item_id: itemId, card_id: card.id, card_name: card.name, card_image_small: card.imageSmall, card_set_name: card.setName } });
          persist("addCustomCard updateSet", { kind: "update", table: "tracked_master_sets", values: { total_cards: totalCards, image }, match: { user_id: user.id, item_id: itemId } });
        }
        return { ...t, customCards, totalCards, image };
      })
    );
  }

  function removeCustomCard(itemId: string, cardId: string) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== itemId || t.type !== "custom") return t;
        const customCards = (t.customCards ?? []).filter((c) => c.id !== cardId);
        const totalCards  = customCards.length;
        if (user) {
          persist("removeCustomCard", { kind: "delete", table: "custom_set_cards", match: { user_id: user.id, item_id: itemId, card_id: cardId } });
          persist("removeCustomCard updateSet", { kind: "update", table: "tracked_master_sets", values: { total_cards: totalCards }, match: { user_id: user.id, item_id: itemId } });
        }
        return { ...t, customCards, totalCards };
      })
    );
  }

  function updateItem(id: string, updates: { label?: string; subtitle?: string; image?: string }) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...updates };
        if (user) {
          persist("updateItem", { kind: "update", table: "tracked_master_sets", values: { label: next.label, subtitle: next.subtitle ?? null, ...(updates.image !== undefined && { image: next.image }) }, match: { user_id: user.id, item_id: id } });
        }
        return next;
      })
    );
  }

  function addCollectionCard(cardId: string) {
    setCollectionCardIds((prev) => {
      if (prev.includes(cardId)) return prev;
      const next = [...prev, cardId];
      if (user) {
        persist("addCollectionCard", { kind: "upsert", table: "collection_cards", onConflict: "user_id,card_id", ignoreDuplicates: true,
          rows: { user_id: user.id, card_id: cardId } });
      }
      return next;
    });
  }

  function removeCollectionCard(cardId: string) {
    setCollectionCardIds((prev) => {
      const next = prev.filter((id) => id !== cardId);
      if (user) {
        persist("removeCollectionCard", { kind: "delete", table: "collection_cards", match: { user_id: user.id, card_id: cardId } });
      }
      return next;
    });
  }

  function isInCollection(cardId: string): boolean {
    return collectionCardIds.includes(cardId);
  }

  return (
    <StoreContext.Provider value={{
      trackedItems, addItem, removeItem, toggleCard,
      isCardOwned, hasItem, updateTotal, reorderItems,
      addCustomCard, removeCustomCard, updateItem,
      collectionCardIds, addCollectionCard, removeCollectionCard, isInCollection,
      syncError, clearSyncError: () => setSyncError(null), reportSyncError: setSyncError,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
