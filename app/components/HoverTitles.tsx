"use client";

import { useEffect } from "react";

// With a mouse, icon-only buttons (✕, ⋯, stars, …) show what they do on hover:
// their accessible label becomes the tooltip. One listener for the whole app.
export default function HoverTitles() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("button, a, [role='button']");
      const label = el?.getAttribute("aria-label");
      if (el && label && !el.title && !el.textContent?.trim()) el.title = label;
    };
    document.addEventListener("mouseover", onOver);
    return () => document.removeEventListener("mouseover", onOver);
  }, []);
  return null;
}
