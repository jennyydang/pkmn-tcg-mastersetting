"use client";

import { useMemo } from "react";

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

// Deterministic 0–1 noise per piece, so rendering stays pure but pieces still scatter.
const noise = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// A one-off burst of falling confetti over the page. Fewer pieces on small
// screens. Hidden entirely when the device asks for reduced motion (globals.css).
export default function Confetti({ onDone }: { onDone?: () => void }) {
  const { pieces, last } = useMemo(() => {
    const count = typeof window !== "undefined" && window.innerWidth < 640 ? 50 : 90;
    const list = Array.from({ length: count }, (_, i) => ({
      end: 1.6 + noise(i, 4) * 1.4 + noise(i, 5) * 0.35,
      left: noise(i, 1) * 100,
      color: COLORS[i % COLORS.length],
      style: {
        "--drift": `${(noise(i, 2) - 0.5) * 30}vw`,
        "--spin": `${(noise(i, 3) - 0.5) * 1440}deg`,
        "--duration": `${1.6 + noise(i, 4) * 1.4}s`,
        "--delay": `${noise(i, 5) * 0.35}s`,
      } as React.CSSProperties,
    }));
    // The piece that lands last ends the burst.
    const last = list.reduce((best, p, i) => (p.end > list[best].end ? i : best), 0);
    return { pieces: list, last };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ ...p.style, left: `${p.left}%`, background: p.color }}
          onAnimationEnd={i === last ? onDone : undefined}
        />
      ))}
    </div>
  );
}
