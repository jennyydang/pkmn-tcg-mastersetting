"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { CheckIcon, StarIcon } from "./Icons";
import { CONDITIONS, Condition, CopyDetails, DEFAULT_DETAILS, GRADE_COMPANIES, GradeCompany, useCardData } from "@/lib/cardData";
import { useConfirm, wantRemovalPrompt } from "@/lib/confirm";
import { useStore } from "@/lib/store";
import { useAddToCollection } from "@/lib/addCopies";
import { conditionPrice } from "@/lib/conditions";
import { VARIANT_LABELS, cardVariants, ownedKey, parseOwnedKey, variantPrice } from "@/lib/variants";
import { CardVariant, PokemonCard } from "@/lib/types";

const inputClass =
  "w-full px-3 py-2 min-h-[40px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function parsePrice(text: string): number | null {
  const n = parseFloat(text.replace(/[$,\s]/g, ""));
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const fmtPrice = (n: number) => `$${n.toFixed(2)}`;

/** Star a card for the want list, with an optional target price. */
export function WantControls({ cardKey, cardName, marketPrice }: { cardKey: string; cardName: string; marketPrice?: number }) {
  const { user } = useAuth();
  const { wants, isWanted, setWant } = useCardData();
  const confirm = useConfirm();
  const wanted = isWanted(cardKey);
  const target = wants.get(cardKey) ?? null;
  const [targetText, setTargetText] = useState(target != null ? String(target) : "");
  const [error, setError]           = useState<string | null>(null);
  const [justSaved, setJustSaved]   = useState(false);

  if (!user) return null;

  const typed = targetText.trim() ? parsePrice(targetText) : null;
  const dirty = targetText.trim() ? typed !== target : target != null;

  function saveTarget() {
    if (targetText.trim() && typed == null) {
      setError("Enter a price like 40 or 12.50.");
      return;
    }
    setError(null);
    setWant(cardKey, true, typed);
    setTargetText(typed != null ? String(typed) : "");
    setJustSaved(true);
  }

  // What the saved target means right now, compared with today's price.
  let status: string | null = null;
  if (target != null) {
    status = marketPrice == null
      ? `We’ll flag ${cardName} when it’s ${fmtPrice(target)} or less.`
      : marketPrice <= target
        ? `It’s ${fmtPrice(marketPrice)} now, already at your target. It’s flagged on your wishlist.`
        : `We’ll flag ${cardName} when it’s ${fmtPrice(target)} or less. It’s ${fmtPrice(marketPrice)} now.`;
  }

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-2">
      <button
        onClick={async () => {
          if (wanted && !(await confirm(wantRemovalPrompt(cardName, target)))) return;
          setWant(cardKey, !wanted, wanted ? null : target); setJustSaved(false); setError(null);
        }}
        aria-pressed={wanted}
        className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 min-h-[40px]"
      >
        <StarIcon className="w-5 h-5" filled={wanted} />
        {wanted ? "On your wishlist" : "Add to wishlist"}
      </button>

      {wanted && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); saveTarget(); (document.activeElement as HTMLElement | null)?.blur(); }}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <label htmlFor={`target-${cardKey}`} className="shrink-0">Flag at or below $</label>
            <input
              id={`target-${cardKey}`}
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="any price"
              value={targetText}
              onChange={(e) => { setTargetText(e.target.value); setJustSaved(false); setError(null); }}
              className={`${inputClass} flex-1 min-w-0`}
              aria-label="Target price in dollars"
            />
            <button
              type="submit"
              disabled={!dirty}
              className="shrink-0 px-4 min-h-[40px] rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-sm font-semibold text-white transition-colors"
            >
              Set
            </button>
          </form>

          {error ? (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">{error}</p>
          ) : dirty ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Tap Set to save your target price.</p>
          ) : justSaved ? (
            <p className="flex items-start gap-1.5 text-sm font-medium text-green-700 dark:text-green-400" role="status">
              <CheckIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{target != null ? `Target set. ${status}` : "Target removed. It’s still on your wishlist."}</span>
            </p>
          ) : status ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">{status}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The versions of a card you own (normal, reverse holo, …), each with its own
 * copies form. Add a version you also have, or remove one you don't, e.g. to
 * correct the version a card was added as. A version counts as owned when it
 * has saved copy details or is checked off in a master set; a card that's only
 * in My Collection counts as its base version.
 */
export function OwnedVersions({ card, initialKey }: { card: PokemonCard; initialKey?: string }) {
  const { trackedItems, toggleCard } = useStore();
  const { details, available, saveDetails, removeDetails } = useCardData();
  const addToCollection = useAddToCollection();
  const confirm = useConfirm();
  const versions = cardVariants(card);

  const recorded = (v: CardVariant) => {
    const key = ownedKey(card, v);
    return details.has(key) || trackedItems.some((t) => t.ownedCards.includes(key));
  };
  const ownedVersions = versions.filter(recorded);
  const implied = ownedVersions.length === 0; // only in My Collection: its base version
  const owned = implied ? [versions[0]] : ownedVersions;

  const initial = initialKey ? parseOwnedKey(initialKey).variant ?? versions[0] : owned[0];
  const [selected, setSelected] = useState<CardVariant>(owned.includes(initial) ? initial : owned[0]);
  const current = owned.includes(selected) ? selected : owned[0];

  async function addVersion(v: CardVariant) {
    // Keep the version it was counted as until now, so adding never silently replaces it.
    if (implied && available) await saveDetails(ownedKey(card, versions[0]), DEFAULT_DETAILS);
    addToCollection(card, v);
    if (available) await saveDetails(ownedKey(card, v), DEFAULT_DETAILS);
    setSelected(v);
  }

  async function removeVersion(v: CardVariant) {
    const key = ownedKey(card, v);
    const sets = trackedItems.filter((t) => t.ownedCards.includes(key));
    const ok = await confirm({
      title: `Remove the ${VARIANT_LABELS[v].long} version?`,
      message: `Its copy details are deleted${sets.length ? ` and it’s unchecked in ${sets.map((t) => t.label).join(", ")}` : ""}. ${card.name} stays in your collection.`,
    });
    if (!ok) return;
    for (const t of sets) toggleCard(t.id, key);
    removeDetails(key);
    setSelected(owned.find((o) => o !== v) ?? versions[0]);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-2">Versions</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Version">
          {versions.map((v) => {
            const isOwned = owned.includes(v);
            const qty = details.get(ownedKey(card, v))?.quantity ?? 1;
            return isOwned ? (
              <button key={v} role="radio" aria-checked={current === v} onClick={() => setSelected(v)}
                className={`px-3 min-h-[40px] rounded-full text-sm font-semibold transition-colors ${current === v ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100"}`}>
                {VARIANT_LABELS[v].long} <span className="opacity-80 font-normal">×{qty}</span>
              </button>
            ) : (
              <button key={v} onClick={() => addVersion(v)} aria-label={`Add ${VARIANT_LABELS[v].long} version`}
                className="px-3 min-h-[40px] rounded-full text-sm font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600">
                + {VARIANT_LABELS[v].long}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Tap a version to edit its copies. Tap + to add a version you also have.</p>
      </div>

      <CopyDetailsForm
        key={current}
        cardKey={ownedKey(card, current)}
        marketPrice={variantPrice(card, current)}
        title={`My copies · ${VARIANT_LABELS[current].long}`}
        onRemove={owned.length > 1 ? () => removeVersion(current) : undefined}
      />
    </div>
  );
}

/** Quantity, condition, grade and price paid for a card you own. */
export function CopyDetailsForm({ cardKey, marketPrice, title = "My copies", onRemove }: { cardKey: string; marketPrice?: number; title?: string; onRemove?: () => void }) {
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
  // Priced for the condition chosen (graded copies at the ungraded market price).
  const unit = marketPrice != null && draft.condition && !draft.gradeCompany ? conditionPrice(marketPrice, draft.condition) : marketPrice;
  const value = unit != null ? unit * draft.quantity : null;
  const gain = value != null && draft.purchasePrice != null ? value - draft.purchasePrice * draft.quantity : null;

  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">{title}</p>

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
        {onRemove && (
          <button onClick={onRemove} className="ml-auto text-sm font-medium text-red-600 dark:text-red-400 hover:underline min-h-[40px]">
            Remove this version
          </button>
        )}
      </div>
    </div>
  );
}
