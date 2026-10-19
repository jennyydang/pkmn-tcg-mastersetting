"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// One in-app "Are you sure?" dialog for every removal, so they all look and
// behave the same (the browser's confirm() shows the site address as a title
// and can't be styled). Usage:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Remove Pikachu?", confirmLabel: "Remove" }))) return;

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label for the button that goes ahead, e.g. "Remove" or "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used within ConfirmProvider");
  return ask;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const ask = useCallback<Ask>((options) => new Promise((resolve) => setPending({ ...options, resolve })), []);

  function answer(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {pending && <ConfirmDialog options={pending} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ options, onAnswer }: { options: ConfirmOptions; onAnswer: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Start on Cancel, so a stray Enter doesn't delete anything; Escape cancels.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onAnswer(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onAnswer]);

  return (
    <div
      className="fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onAnswer(false); }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={options.message ? "confirm-message" : undefined}
        className="dialog-in bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6">
          <h2 id="confirm-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">{options.title}</h2>
          {options.message && <p id="confirm-message" className="text-sm text-gray-500 dark:text-gray-400 mt-2">{options.message}</p>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button ref={cancelRef} onClick={() => onAnswer(false)}
            className="flex-1 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {options.cancelLabel ?? "Cancel"}
          </button>
          <button onClick={() => onAnswer(true)}
            className="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">
            {options.confirmLabel ?? "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmtPrice = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/** Shared wording for taking a card off the want list (its target price goes too). */
export function wantRemovalPrompt(cardName: string, target: number | null | undefined): ConfirmOptions {
  return {
    title: `Remove ${cardName} from your want list?`,
    message: target != null ? `Your ${fmtPrice(target)} target price will be removed too.` : undefined,
    confirmLabel: "Remove",
  };
}
