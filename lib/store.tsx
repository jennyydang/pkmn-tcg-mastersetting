"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { CustomCardDef, TrackedMasterSet } from "./types";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

const STORAGE_KEY = "pkmn-tcg-mastersetting-v3";

interface StoreContextValue {
  trackedItems:    TrackedMasterSet[];
  addItem:         (item: TrackedMasterSet) => void;
  removeItem:      (id: string) => void;
  toggleCard:      (id: string, cardId: string) => void;
  isCardOwned:     (id: string, cardId: string) => boolean;
  hasItem:         (id: string) => boolean;
  updateTotal:     (id: string, total: number) => void;
  reorderItems:    (fromId: string, toId: string) => void;
  addCustomCard:   (itemId: string, card: CustomCardDef) => void;
  removeCustomCard:(itemId: string, cardId: string) => void;
  updateItem:      (id: string, updates: { label?: string; subtitle?: string }) => void;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trackedItems, setTrackedItems] = useState<TrackedMasterSet[]>([]);
  const [hydrated, setHydrated]         = useState(false);
  // Only write to Supabase after we've confirmed the full server-state for this user.
  const loadedForUser = useRef<string | null>(null);

  // ── 1. Hydrate from localStorage immediately for a fast first paint ──────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrackedItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // ── 2. Load from Supabase when the authenticated user changes ────────────
  useEffect(() => {
    if (!user) {
      setTrackedItems([]);
      localStorage.removeItem(STORAGE_KEY);
      loadedForUser.current = null;
      return;
    }

    async function loadFromSupabase() {
      const [{ data: sets, error: setsErr }, { data: cards, error: cardsErr }, { data: customCards, error: customErr }] =
        await Promise.all([
          supabase
            .from("tracked_master_sets")
            .select("item_id, type, label, image, total_cards, subtitle, sort_order")
            .eq("user_id", user!.id)
            .order("sort_order", { ascending: true }),
          supabase
            .from("owned_cards")
            .select("item_id, card_id")
            .eq("user_id", user!.id),
          supabase
            .from("custom_set_cards")
            .select("item_id, card_id, card_name, card_image_small, card_set_name")
            .eq("user_id", user!.id),
        ]);

      if (setsErr || cardsErr || customErr) {
        console.error("Supabase load error", setsErr ?? cardsErr ?? customErr);
        return;
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

      setTrackedItems(loaded);
      loadedForUser.current = user!.id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    }

    loadFromSupabase();
  }, [user]);

  // ── 3. Keep localStorage in sync ─────────────────────────────────────────
  useEffect(() => {
    if (hydrated && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedItems));
    }
  }, [trackedItems, hydrated, user]);

  // Guard: only write to Supabase once the load for this user completed.
  function canWrite(uid: string | undefined): uid is string {
    return !!uid && loadedForUser.current === uid;
  }

  // ── Mutations (optimistic local-first, Supabase in background) ───────────

  function addItem(item: TrackedMasterSet) {
    setTrackedItems((prev) => {
      if (prev.some((t) => t.id === item.id)) return prev;
      const next = [...prev, item];
      if (canWrite(user?.id)) {
        supabase
          .from("tracked_master_sets")
          .upsert({
            user_id:     user!.id,
            item_id:     item.id,
            type:        item.type,
            label:       item.label,
            image:       item.image,
            total_cards: item.totalCards,
            subtitle:    item.subtitle ?? null,
            sort_order:  next.length - 1,
          }, { onConflict: "user_id,item_id" })
          .then(({ error }) => { if (error) console.error("addItem", error); });
      }
      return next;
    });
  }

  function removeItem(id: string) {
    setTrackedItems((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (canWrite(user?.id)) {
        Promise.all([
          supabase.from("owned_cards").delete().eq("user_id", user!.id).eq("item_id", id),
          supabase.from("custom_set_cards").delete().eq("user_id", user!.id).eq("item_id", id),
          supabase.from("tracked_master_sets").delete().eq("user_id", user!.id).eq("item_id", id),
        ]).then(([{ error: e1 }, { error: e2 }, { error: e3 }]) => {
          if (e1) console.error("removeItem owned_cards", e1);
          if (e2) console.error("removeItem custom_set_cards", e2);
          if (e3) console.error("removeItem tracked_master_sets", e3);
        });
      }
      return next;
    });
  }

  function toggleCard(id: string, cardId: string) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const wasOwned = t.ownedCards.includes(cardId);
        const ownedCards = wasOwned
          ? t.ownedCards.filter((c) => c !== cardId)
          : [...t.ownedCards, cardId];

        if (canWrite(user?.id)) {
          if (!wasOwned) {
            supabase
              .from("owned_cards")
              .upsert(
                { user_id: user!.id, item_id: id, card_id: cardId },
                { onConflict: "user_id,item_id,card_id", ignoreDuplicates: true }
              )
              .then(({ error }) => { if (error) console.error("toggleCard insert", error); });
          } else {
            supabase
              .from("owned_cards")
              .delete()
              .eq("user_id", user!.id)
              .eq("item_id", id)
              .eq("card_id", cardId)
              .then(({ error }) => { if (error) console.error("toggleCard delete", error); });
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
        if (canWrite(user?.id)) {
          supabase
            .from("tracked_master_sets")
            .update({ total_cards: total })
            .eq("user_id", user!.id)
            .eq("item_id", id)
            .then(({ error }) => { if (error) console.error("updateTotal", error); });
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

      if (canWrite(user?.id)) {
        const rows = next.map((t, index) => ({
          user_id:     user!.id,
          item_id:     t.id,
          type:        t.type,
          label:       t.label,
          image:       t.image,
          total_cards: t.totalCards,
          subtitle:    t.subtitle ?? null,
          sort_order:  index,
        }));
        supabase
          .from("tracked_master_sets")
          .upsert(rows, { onConflict: "user_id,item_id" })
          .then(({ error }) => { if (error) console.error("reorderItems", error); });
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
        if (canWrite(user?.id)) {
          supabase.from("custom_set_cards")
            .upsert({ user_id: user!.id, item_id: itemId, card_id: card.id, card_name: card.name, card_image_small: card.imageSmall, card_set_name: card.setName }, { onConflict: "user_id,item_id,card_id", ignoreDuplicates: true })
            .then(({ error }) => { if (error) console.error("addCustomCard", error); });
          supabase.from("tracked_master_sets")
            .update({ total_cards: totalCards, image })
            .eq("user_id", user!.id).eq("item_id", itemId)
            .then(({ error }) => { if (error) console.error("addCustomCard updateSet", error); });
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
        if (canWrite(user?.id)) {
          supabase.from("custom_set_cards")
            .delete().eq("user_id", user!.id).eq("item_id", itemId).eq("card_id", cardId)
            .then(({ error }) => { if (error) console.error("removeCustomCard", error); });
          supabase.from("tracked_master_sets")
            .update({ total_cards: totalCards })
            .eq("user_id", user!.id).eq("item_id", itemId)
            .then(({ error }) => { if (error) console.error("removeCustomCard updateSet", error); });
        }
        return { ...t, customCards, totalCards };
      })
    );
  }

  function updateItem(id: string, updates: { label?: string; subtitle?: string }) {
    setTrackedItems((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...updates };
        if (canWrite(user?.id)) {
          supabase
            .from("tracked_master_sets")
            .update({ label: next.label, subtitle: next.subtitle ?? null })
            .eq("user_id", user!.id)
            .eq("item_id", id)
            .then(({ error }) => { if (error) console.error("updateItem", error); });
        }
        return next;
      })
    );
  }

  return (
    <StoreContext.Provider value={{
      trackedItems, addItem, removeItem, toggleCard,
      isCardOwned, hasItem, updateTotal, reorderItems,
      addCustomCard, removeCustomCard, updateItem,
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
