"use client";

import { useEffect, useRef } from "react";

// On the scan page, the camera button in the middle of the phone tab bar is the
// shutter: it takes the photo while the camera is showing, and goes back to the
// camera from a result. The tab bar fires this event; the scan page handles it.

const EVENT = "pocketi-scan-shutter";

export function pressShutter() {
  window.dispatchEvent(new Event(EVENT));
}

/** Run `handler` when the tab bar's camera button is pressed on the scan page. */
export function useShutter(handler: () => void, enabled = true) {
  const latest = useRef(handler);
  useEffect(() => { latest.current = handler; });
  useEffect(() => {
    if (!enabled) return;
    const run = () => latest.current();
    window.addEventListener(EVENT, run);
    return () => window.removeEventListener(EVENT, run);
  }, [enabled]);
}
