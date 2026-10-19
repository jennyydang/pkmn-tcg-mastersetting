"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { useStore } from "./store";

// Want list and details about the copies you own (supabase/wants_and_copies.sql).
// Both are keyed like owned_cards: "<card id>" or "<card id>|<variant>".

export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type GradeCompany = "PSA" | "BGS" | "CGC" | "TAG" | "Other";

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "NM",  label: "Near Mint" },
  { value: "LP",  label: "Lightly Played" },
  { value: "MP",  label: "Moderately Played" },
  { value: "HP",  label: "Heavily Played" },
  { value: "DMG", label: "Damaged" },
];
export const GRADE_COMPANIES: GradeCompany[] = ["PSA", "BGS", "CGC", "TAG", "Other"];

export interface CopyDetails {
  quantity: number;
  condition: Condition | null;
  gradeCompany: GradeCompany | null;
  grade: string | null;
  /** Price paid per copy. */
  purchasePrice: number | null;
}

export const DEFAULT_DETAILS: CopyDetails = { quantity: 1, condition: null, gradeCompany: null, grade: null, purchasePrice: null };

interface CardDataValue {
  /** False until both tables load; e.g. before the SQL has been run. */
  available: boolean;
  wants: Map<string, number | null>;
  isWanted: (key: string) => boolean;
  setWant: (key: string, wanted: boolean, targetPrice?: number | null) => void;
  details: Map<string, CopyDetails>;
  detailsFor: (key: string) => CopyDetails;
  saveDetails: (key: string, details: CopyDetails) => Promise<boolean>;
}

const CardDataContext = createContext<CardDataValue | null>(null);

export function CardDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { reportSyncError } = useStore();
  const userId = user?.id;
  const [available, setAvailable] = useState(false);
  const [wants, setWants]         = useState<Map<string, number | null>>(new Map());
  const [details, setDetails]     = useState<Map<string, CopyDetails>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      supabase.from("want_list").select("card_id, target_price").eq("user_id", userId),
      supabase.from("card_details").select("card_id, quantity, condition, grade_company, grade, purchase_price").eq("user_id", userId),
    ]).then(([w, d]) => {
      if (cancelled) return;
      if (w.error || d.error) {
        console.error("Supabase load error (want_list/card_details)", w.error ?? d.error);
        setAvailable(false);
        return;
      }
      setWants(new Map(w.data.map((r) => [r.card_id, r.target_price == null ? null : Number(r.target_price)])));
      setDetails(new Map(d.data.map((r) => [r.card_id, {
        quantity:      r.quantity,
        condition:     r.condition,
        gradeCompany:  r.grade_company,
        grade:         r.grade,
        purchasePrice: r.purchase_price == null ? null : Number(r.purchase_price),
      }])));
      setAvailable(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const notReady = useCallback(() => {
    reportSyncError("Want list and card details aren't set up yet. Run supabase/wants_and_copies.sql in Supabase.");
  }, [reportSyncError]);

  const setWant = useCallback((key: string, wanted: boolean, targetPrice: number | null = null) => {
    if (!userId || !available) { notReady(); return; }
    setWants((prev) => {
      const next = new Map(prev);
      if (wanted) next.set(key, targetPrice);
      else next.delete(key);
      return next;
    });
    const op = wanted
      ? supabase.from("want_list").upsert({ user_id: userId, card_id: key, target_price: targetPrice }, { onConflict: "user_id,card_id" })
      : supabase.from("want_list").delete().eq("user_id", userId).eq("card_id", key);
    op.then(({ error }) => {
      if (error) reportSyncError(`Couldn't save your want list (${error.message}). Refresh to see what's saved.`);
    });
  }, [userId, available, notReady, reportSyncError]);

  const saveDetails = useCallback(async (key: string, d: CopyDetails) => {
    if (!userId || !available) { notReady(); return false; }
    const { error } = await supabase.from("card_details").upsert({
      user_id:        userId,
      card_id:        key,
      quantity:       d.quantity,
      condition:      d.condition,
      grade_company:  d.gradeCompany,
      grade:          d.gradeCompany ? d.grade : null,
      purchase_price: d.purchasePrice,
      updated_at:     new Date().toISOString(),
    }, { onConflict: "user_id,card_id" });
    if (error) {
      reportSyncError(`Couldn't save card details (${error.message}).`);
      return false;
    }
    setDetails((prev) => new Map(prev).set(key, d));
    return true;
  }, [userId, available, notReady, reportSyncError]);

  const value: CardDataValue = {
    available: !!userId && available,
    wants: userId ? wants : new Map(),
    isWanted: (key) => !!userId && wants.has(key),
    setWant,
    details: userId ? details : new Map(),
    detailsFor: (key) => (userId && details.get(key)) || DEFAULT_DETAILS,
    saveDetails,
  };

  return <CardDataContext.Provider value={value}>{children}</CardDataContext.Provider>;
}

export function useCardData() {
  const ctx = useContext(CardDataContext);
  if (!ctx) throw new Error("useCardData must be used within CardDataProvider");
  return ctx;
}
