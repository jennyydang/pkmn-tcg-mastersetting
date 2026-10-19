"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { isOnline } from "./online";

// Saves that couldn't reach Supabase (offline, or the request failed to send)
// wait here, in localStorage, and are replayed in order when the connection
// returns. While anything is waiting, new saves queue behind it so the server
// sees changes in the order they were made.

type Row = Record<string, unknown>;

export type WriteOp =
  | { kind: "upsert"; table: string; rows: Row | Row[]; onConflict: string; ignoreDuplicates?: boolean }
  | { kind: "update"; table: string; values: Row; match: Record<string, string> }
  | { kind: "delete"; table: string; match: Record<string, string> };

interface Queued {
  userId: string;
  op: WriteOp;
  label: string;
}

export interface WriteError {
  message: string;
}

const KEY = "pocketi-sync-queue";
const CHANGE_EVENT = "pocketi-sync-queue-change";

function load(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(queue: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

async function execute(op: WriteOp): Promise<WriteError | null> {
  const table = supabase.from(op.table);
  let query;
  if (op.kind === "upsert") {
    query = table.upsert(op.rows, { onConflict: op.onConflict, ignoreDuplicates: op.ignoreDuplicates });
  } else {
    let q = op.kind === "update" ? table.update(op.values) : table.delete();
    for (const [column, value] of Object.entries(op.match)) q = q.eq(column, value);
    query = q;
  }
  const { error } = await query;
  return error;
}

/** A request that never reached the server, as opposed to one the server rejected. */
export function isNetworkError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  return !isOnline() || (!error.code && /fetch|network|load failed|timed out/i.test(error.message ?? ""));
}

/**
 * Save now, or queue it if offline / the request can't be sent. Resolves with an
 * error only when the server rejected the change.
 */
export async function writeOrQueue(userId: string, label: string, op: WriteOp): Promise<WriteError | null> {
  const queue = load();
  if (!isOnline() || queue.some((q) => q.userId === userId)) {
    save([...queue, { userId, op, label }]);
    if (isOnline()) void flushQueue(userId);
    return null;
  }
  const error = await execute(op);
  if (isNetworkError(error)) {
    save([...load(), { userId, op, label }]);
    return null;
  }
  return error;
}

let flushing: Promise<WriteError[]> | null = null;

/**
 * Replay this user's queued saves in order. Stops at the first one that still
 * can't be sent; drops (and returns) any the server rejects.
 */
export function flushQueue(userId: string): Promise<WriteError[]> {
  if (!flushing) {
    flushing = (async () => {
      const rejected: WriteError[] = [];
      while (isOnline()) {
        const next = load().find((q) => q.userId === userId);
        if (!next) break;
        const error = await execute(next.op);
        if (isNetworkError(error)) break;
        if (error) {
          console.error("Queued save rejected", next.label, error);
          rejected.push(error);
        }
        // Remove exactly this entry (new saves may have been queued meanwhile).
        const queue = load();
        const i = queue.findIndex((q) => q.userId === userId && JSON.stringify(q.op) === JSON.stringify(next.op));
        if (i >= 0) queue.splice(i, 1);
        save(queue);
      }
      return rejected;
    })().finally(() => { flushing = null; });
  }
  return flushing;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Number of saves waiting to sync for this user. */
export function usePendingCount(userId: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? load().filter((q) => q.userId === userId).length : 0),
    () => 0,
  );
}
