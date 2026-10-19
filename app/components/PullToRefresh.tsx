"use client";

import { useEffect, useRef, useState } from "react";
import { refreshAll } from "@/lib/refresh";
import { tapFeedback } from "@/lib/haptics";
import { SyncIcon } from "./Icons";

// Pull down from the top of the page on a touch screen to refresh: reloads your
// saved data (lib/refresh.ts) and re-mounts the page so it fetches fresh cards
// and prices.

const THRESHOLD = 72; // px of (damped) pull needed to refresh
const MAX_PULL = 120;
const MIN_SPIN_MS = 600; // keep the spinner up long enough to register

/** Whether a touch starts somewhere a pull shouldn't refresh: a dialog, the tab bar, or a scrolled panel. */
function blocked(target: EventTarget | null) {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) return true;
    if (getComputedStyle(el).position === "fixed") return true;
  }
  return false;
}

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false); // finger down: no easing
  const [pageKey, setPageKey] = useState(0);
  const start = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const setPullBoth = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length > 1 || window.scrollY > 0 || blocked(e.target)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y;
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // Only a downward, mostly-vertical drag from the top is a pull.
        s.axis = dy > 0 && Math.abs(dy) > Math.abs(dx) ? "y" : "x";
        if (s.axis === "x") { start.current = null; return; }
        setDragging(true);
      }
      const next = Math.min(MAX_PULL, Math.max(0, dy * 0.5));
      if (pullRef.current < THRESHOLD && next >= THRESHOLD) tapFeedback();
      setPullBoth(next);
    };
    const onEnd = async () => {
      const s = start.current;
      start.current = null;
      if (!s || s.axis !== "y") return;
      setDragging(false);
      if (pullRef.current < THRESHOLD) { setPullBoth(0); return; }
      refreshingRef.current = true;
      setRefreshing(true);
      setPullBoth(THRESHOLD * 0.75);
      setPageKey((k) => k + 1);
      await Promise.all([refreshAll(), new Promise((r) => setTimeout(r, MIN_SPIN_MS))]);
      refreshingRef.current = false;
      setRefreshing(false);
      setPullBoth(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const progress = Math.min(1, pull / THRESHOLD);
  const ease = dragging ? "none" : "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease";

  return (
    <>
      <div
        aria-hidden={!refreshing}
        role="status"
        className="fixed left-1/2 z-30 top-[calc(env(safe-area-inset-top)+3.5rem)] pointer-events-none"
        style={{
          transform: `translate(-50%, ${pull - 44}px)`,
          opacity: pull > 4 || refreshing ? 1 : 0,
          transition: ease,
        }}
      >
        <div className="mt-2 w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-blue-600 dark:text-blue-400">
          <span className={refreshing ? "animate-spin" : ""} style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.4 + progress * 0.6 }}>
            <SyncIcon className="w-5 h-5" />
          </span>
          {refreshing && <span className="sr-only">Refreshing</span>}
        </div>
      </div>
      <div key={pageKey} style={{ transform: pull ? `translateY(${pull * 0.5}px)` : undefined, transition: ease }}>
        {children}
      </div>
    </>
  );
}
