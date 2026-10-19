import type React from "react";

// Mouse-only tilt toward the cursor for .tile elements (see globals.css). Touch
// and pen are ignored, so phones and tablets get the press effect instead.
const MAX_TILT_DEG = 6;

export const tiltHandlers = {
  onPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--tilt-x", `${(-y * MAX_TILT_DEG).toFixed(2)}deg`);
    el.style.setProperty("--tilt-y", `${(x * MAX_TILT_DEG).toFixed(2)}deg`);
  },
  onPointerLeave(e: React.PointerEvent<HTMLElement>) {
    e.currentTarget.style.removeProperty("--tilt-x");
    e.currentTarget.style.removeProperty("--tilt-y");
  },
};

/** Style for the nth item of a cascading list (.stagger-in). */
export const staggerStyle = (i: number) => ({ "--i": i }) as React.CSSProperties;
