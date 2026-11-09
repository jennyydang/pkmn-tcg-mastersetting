"use client";

import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { siteUrl } from "./appInfo";
import { CustomCardDef, SetStatus, TrackedMasterSet } from "./types";

// Sharing your collection with friends (supabase/collection_shares.sql). Each
// account has at most one share link. The link carries only a random token;
// whoever opens it sees your master sets as they are now, read-only, through
// the get_shared_collection function. Stopping or renewing the link deletes
// the token, so old links stop working.

export interface MyShare {
  token: string;
  name: string | null;
}

export interface SharedCollection {
  name: string | null;
  sets: TrackedMasterSet[];
}

export const SHARE_SETUP_MESSAGE = "Sharing isn't set up yet. Run supabase/collection_shares.sql in Supabase.";

export const MAX_SHARE_NAME = 40;

/** The table or function doesn't exist yet, i.e. the SQL hasn't been run. */
export function isNotSetUp(error: Pick<PostgrestError, "code"> | null) {
  // 42P01: undefined table; 42883: undefined function; PGRST2xx: not in the API schema cache.
  return !!error && (error.code === "42P01" || error.code === "42883" || error.code === "PGRST202" || error.code === "PGRST205");
}

export class ShareError extends Error {
  constructor(public notSetUp: boolean, message: string) {
    super(message);
  }
}

function fail(error: PostgrestError): never {
  throw new ShareError(isNotSetUp(error), isNotSetUp(error) ? SHARE_SETUP_MESSAGE : error.message);
}

const cleanName = (name: string) => name.trim().slice(0, MAX_SHARE_NAME) || null;

/** Your current share link, or null if you aren't sharing. */
export async function getMyShare(userId: string): Promise<MyShare | null> {
  const { data, error } = await supabase.from("collection_shares").select("token, display_name").eq("user_id", userId).maybeSingle();
  if (error) fail(error);
  return data ? { token: data.token, name: data.display_name } : null;
}

/** Start sharing, or get a new link (the old one stops working). */
export async function createShare(userId: string, name: string): Promise<MyShare> {
  const del = await supabase.from("collection_shares").delete().eq("user_id", userId);
  if (del.error) fail(del.error);
  const { data, error } = await supabase
    .from("collection_shares")
    .insert({ user_id: userId, display_name: cleanName(name) })
    .select("token, display_name")
    .single();
  if (error) fail(error);
  return { token: data.token, name: data.display_name };
}

export async function renameShare(userId: string, name: string): Promise<void> {
  const { error } = await supabase.from("collection_shares").update({ display_name: cleanName(name) }).eq("user_id", userId);
  if (error) fail(error);
}

/** Stop sharing: the link stops working right away. */
export async function stopSharing(userId: string): Promise<void> {
  const { error } = await supabase.from("collection_shares").delete().eq("user_id", userId);
  if (error) fail(error);
}

export function shareUrl(token: string) {
  return `${siteUrl()}/shared?c=${encodeURIComponent(token)}`;
}

// ── Viewing ─────────────────────────────────────────────────────────────────

interface RawSet {
  id: string;
  type: TrackedMasterSet["type"];
  label: string;
  image: string;
  total_cards: number;
  subtitle: string | null;
  status: SetStatus | null;
  owned: string[];
  custom_cards: { id: string; name: string; image: string; set_name: string }[] | null;
}

/** A shared collection, or null if the link doesn't work (stopped or mistyped). */
export async function getSharedCollection(token: string): Promise<SharedCollection | null> {
  const { data, error } = await supabase.rpc("get_shared_collection", { share_token: token });
  if (error) fail(error);
  if (!data) return null;
  const raw = data as { name: string | null; sets: RawSet[] };
  return {
    name: raw.name,
    sets: raw.sets.map((s) => ({
      type:        s.type,
      id:          s.id,
      label:       s.label,
      image:       s.image,
      totalCards:  s.total_cards,
      subtitle:    s.subtitle ?? undefined,
      status:      s.status ?? undefined,
      ownedCards:  s.owned,
      customCards: s.custom_cards?.map((c): CustomCardDef => ({ id: c.id, name: c.name, imageSmall: c.image, setName: c.set_name })),
    })),
  };
}
