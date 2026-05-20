"use client";

import { useEffect, useState } from "react";
import { TrackedMasterSet } from "@/lib/types";

interface Props {
  item: TrackedMasterSet;
  onSave: (updates: { label: string; subtitle: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function CollectionEditSheet({ item, onSave, onDelete, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [subtitle, setSubtitle] = useState(item.subtitle ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handleSave() {
    onSave({ label: label.trim() || item.label, subtitle: subtitle.trim() });
    handleClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={handleClose} aria-hidden="true" />

      {/* Bottom sheet on mobile → centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-sheet-title"
        className={`fixed z-50 bottom-0 inset-x-0 md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out ${
          visible
            ? "translate-y-0 md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-100 md:scale-100"
            : "translate-y-full md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-0 md:scale-95"
        }`}
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden mx-auto mt-3 mb-1 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden="true" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-gray-100" id="edit-sheet-title">Edit Collection</h2>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="edit-label" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Name
            </label>
            <input
              id="edit-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="edit-subtitle" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <input
              id="edit-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Optional description"
              className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="w-full py-3 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Save Changes
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-3 min-h-[44px] rounded-xl border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              Delete Collection
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className="flex-1 py-3 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Confirm Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
