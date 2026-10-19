"use client";

import { useEffect, useRef } from "react";

// Pull-to-refresh (app/components/PullToRefresh.tsx) asks everything that holds
// server data to reload. Each listener hands back a promise so the spinner
// stays up until the reloads finish.

const EVENT = "pocketi-refresh";

interface RefreshDetail {
  waitUntil: (p: Promise<unknown>) => void;
}

/** Reload all data; resolves when every listener has finished. */
export async function refreshAll() {
  const waits: Promise<unknown>[] = [];
  window.dispatchEvent(new CustomEvent<RefreshDetail>(EVENT, { detail: { waitUntil: (p) => waits.push(p) } }));
  await Promise.allSettled(waits);
}

/** Run `handler` on refresh; return a promise from it to delay the spinner. */
export function useOnRefresh(handler: () => Promise<unknown> | void) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    const onRefresh = (e: Event) => {
      const p = latest.current();
      if (p) (e as CustomEvent<RefreshDetail>).detail.waitUntil(p);
    };
    window.addEventListener(EVENT, onRefresh);
    return () => window.removeEventListener(EVENT, onRefresh);
  }, []);
}
