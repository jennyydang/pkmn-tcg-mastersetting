"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { CONDITIONS, Condition, CopyDetails, GRADE_COMPANIES, GradeCompany, useCardData } from "@/lib/cardData";

const inputClass =
  "w-full px-3 py-2 min-h-[40px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function parsePrice(text: string): number | null {
  const n = parseFloat(text.replace(/[$,\s]/g, ""));
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Star a card for the want list, with an optional target price. */
export function WantControls({ cardKey }: { cardKey: string }) {
  const { user } = useAuth();
  const { wants, isWanted, setWant } = useCardData();
  const wanted = isWanted(cardKey);
  const target = wants.get(cardKey) ?? null;
  const [targetText, setTargetText] = useState(target != null ? String(target) : "");

  if (!user) return null;

  function saveTarget() {
    const next = targetText.trim() ? parsePrice(targetText) : null;
    if (next !== target) setWant(cardKey, true, next);
    setTargetText(next != null ? String(next) : "");
  }

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-2">
      <button
        onClick={() => setWant(cardKey, !wanted, wanted ? null : parsePrice(targetText))}
        aria-pressed={wanted}
        className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 min-h-[40px]"
      >
        <span className="text-lg" aria-hidden="true">{wanted ? "★" : "☆"}</span>
        {wanted ? "On your want list" : "Add to want list"}
      </button>
      {wanted && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span className="shrink-0">Flag when it’s at or below $</span>
          <input
            inputMode="decimal"
            placeholder="any price"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            onBlur={saveTarget}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className={`${inputClass} w-28`}
            aria-label="Target price in dollars"
          />
        </label>
      )}
    </div>
  );
}

/** Quantity, condition, grade and price paid for a card you own. */
export function CopyDetailsForm({ cardKey, marketPrice }: { cardKey: string; marketPrice?: number }) {
  const { detailsFor, saveDetails } = useCardData();
  const saved = detailsFor(cardKey);
  const [d, setD]           = useState<CopyDetails>(saved);
  const [paidText, setPaidText] = useState(saved.purchasePrice != null ? String(saved.purchasePrice) : "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const draft: CopyDetails = { ...d, purchasePrice: paidText.trim() ? parsePrice(paidText) : null };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    const ok = await saveDetails(cardKey, draft);
    setSaving(false);
    setMessage(ok ? "Saved" : null);
  }

  const update = (patch: Partial<CopyDetails>) => { setD((prev) => ({ ...prev, ...patch })); setMessage(null); };
  const value = marketPrice != null ? marketPrice * draft.quantity : null;
  const gain = value != null && draft.purchasePrice != null ? value - draft.purchasePrice * draft.quantity : null;

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">My copies</p>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-300 w-20">Quantity</span>
        <div className="flex items-center gap-1">
          <button onClick={() => update({ quantity: Math.max(1, d.quantity - 1) })} aria-label="One fewer"
            className="w-10 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-lg font-bold text-gray-700 dark:text-gray-200">−</button>
          <span className="w-10 text-center font-semibold tabular-nums text-gray-900 dark:text-gray-100" aria-live="polite">{d.quantity}</span>
          <button onClick={() => update({ quantity: Math.min(9999, d.quantity + 1) })} aria-label="One more"
            className="w-10 h-10 rounded-xl border border-gray-300 dark:border-gray-600 text-lg font-bold text-gray-700 dark:text-gray-200">+</button>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-300 w-20 shrink-0">Condition</span>
        <select value={d.condition ?? ""} onChange={(e) => update({ condition: (e.target.value || null) as Condition | null })} className={inputClass}>
          <option value="">Not set</option>
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label} ({c.value})</option>)}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-300 w-20 shrink-0">Graded</span>
        <select value={d.gradeCompany ?? ""} aria-label="Grading company"
          onChange={(e) => update({ gradeCompany: (e.target.value || null) as GradeCompany | null })} className={inputClass}>
          <option value="">Not graded</option>
          {GRADE_COMPANIES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {d.gradeCompany && (
          <input value={d.grade ?? ""} maxLength={10} placeholder="Grade" aria-label="Grade"
            onChange={(e) => update({ grade: e.target.value || null })} className={`${inputClass} w-20`} />
        )}
      </div>

      <label className="flex items-center gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-300 w-20 shrink-0">Paid each</span>
        <input inputMode="decimal" placeholder="$0.00" value={paidText}
          onChange={(e) => { setPaidText(e.target.value); setMessage(null); }} className={inputClass} />
      </label>

      {value != null && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Worth about <span className="font-semibold">${value.toFixed(2)}</span>
          {gain != null && (
            <span className={gain >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
              {" "}({gain >= 0 ? "+" : "−"}${Math.abs(gain).toFixed(2)})
            </span>
          )}
          {d.gradeCompany && <span className="block text-xs text-gray-500 dark:text-gray-400">Based on the ungraded market price.</span>}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dirty || saving}
          className="px-4 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors">
          {saving ? "Saving…" : "Save"}
        </button>
        {message && <span className="text-sm text-green-600 dark:text-green-400">{message}</span>}
      </div>
    </div>
  );
}
