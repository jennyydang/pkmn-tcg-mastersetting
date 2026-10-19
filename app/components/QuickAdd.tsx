"use client";

import { useState } from "react";
import { PokemonCard } from "@/lib/types";
import { parseQuickAdd } from "@/lib/quickAdd";
import { VARIANT_LABELS, cardVariants } from "@/lib/variants";
import { successFeedback } from "@/lib/haptics";
import { CheckIcon } from "./Icons";

interface Props {
  cards: PokemonCard[];
  owned: Set<string>;
  onToggle: (key: string) => void;
}

interface Summary {
  added: { key: string; label: string }[];
  alreadyOwned: number;
  problems: string[];
}

// Mark several cards in a set owned by typing their numbers (see lib/quickAdd.ts).
export default function QuickAdd({ cards, owned, onToggle }: Props) {
  const [text, setText]       = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [undone, setUndone]   = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = parseQuickAdd(text, cards, owned);
    for (const { key } of r.toAdd) onToggle(key);
    if (r.toAdd.length) successFeedback();
    setSummary({
      added: r.toAdd.map(({ key, card, variant }) => ({
        key,
        // Name the version only when it isn't the card's base one ("25r" → Reverse Holo).
        label: `${card.name} #${card.number}${variant !== cardVariants(card)[0] ? ` (${VARIANT_LABELS[variant].long})` : ""}`,
      })),
      alreadyOwned: r.alreadyOwned,
      problems: r.problems,
    });
    setUndone(false);
    if (r.problems.length === 0) setText("");
  }

  function undo() {
    // Only unmark what this quick add marked, and only if still marked.
    for (const { key } of summary?.added ?? []) if (owned.has(key)) onToggle(key);
    setUndone(true);
  }

  const added = summary?.added ?? [];

  return (
    <div className="mb-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <form onSubmit={submit} className="flex items-center gap-2">
        <label htmlFor="quick-add" className="text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">Quick add</label>
        <input
          id="quick-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="25, 57, 1-10, 25r"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="done"
          className="flex-1 min-w-0 px-3 py-2 min-h-[40px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-describedby="quick-add-help"
        />
        <button type="submit" disabled={!text.trim()}
          className="shrink-0 px-4 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-sm font-semibold text-white transition-colors">
          Add
        </button>
      </form>
      <p id="quick-add-help" className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Card numbers or ranges. Add <b>r</b>, <b>h</b> or <b>f</b> for reverse holo, holo or 1st Edition.
      </p>

      {summary && (
        <div className="mt-3 text-sm space-y-1 fade-in" role="status">
          {added.length > 0 && (
            <p className={`flex items-start gap-1.5 ${undone ? "text-gray-500 dark:text-gray-400" : "text-green-700 dark:text-green-400"}`}>
              {!undone && <CheckIcon className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>
                {undone ? "Undone. " : `Marked ${added.length} ${added.length === 1 ? "card" : "cards"}: `}
                {!undone && added.slice(0, 5).map((a) => a.label).join(", ")}
                {!undone && added.length > 5 && ` and ${added.length - 5} more`}
                {!undone && (
                  <> · <button onClick={undo} className="font-semibold underline">Undo</button></>
                )}
              </span>
            </p>
          )}
          {summary.alreadyOwned > 0 && (
            <p className="text-gray-500 dark:text-gray-400">
              {summary.alreadyOwned} already owned.
            </p>
          )}
          {summary.problems.map((p) => (
            <p key={p} className="text-red-500 dark:text-red-400">{p}</p>
          ))}
          {added.length === 0 && summary.alreadyOwned === 0 && summary.problems.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">Nothing to add.</p>
          )}
        </div>
      )}
    </div>
  );
}
