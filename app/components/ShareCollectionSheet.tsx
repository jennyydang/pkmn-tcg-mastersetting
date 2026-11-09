"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/lib/confirm";
import { successFeedback } from "@/lib/haptics";
import { MAX_SHARE_NAME, MyShare, ShareError, createShare, getMyShare, renameShare, shareUrl, stopSharing } from "@/lib/share";
import { CheckIcon, ShareIcon } from "./Icons";

interface Props {
  onClose: () => void;
}

function message(e: unknown) {
  return e instanceof ShareError ? e.message : "Something went wrong. Check your connection and try again.";
}

// Turn on a link friends can open to see your master sets: what you have and
// what you're missing. Also gets a new link or stops sharing.
export default function ShareCollectionSheet({ onClose }: Props) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [visible, setVisible] = useState(false);
  // undefined while loading; null when not sharing.
  const [share, setShare] = useState<MyShare | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyShare(user.id)
      .then((s) => { if (!cancelled) { setShare(s); setName(s?.name ?? ""); } })
      .catch((e) => { if (!cancelled) { setShare(null); setError(message(e)); } });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const start = () => run(async () => {
    const s = await createShare(user!.id, name);
    setShare(s);
    successFeedback();
  });

  const renew = () => run(async () => {
    if (!(await confirm({ title: "Get a new link?", message: "The current link stops working, so anyone you sent it to won’t see your collection until you send the new one.", confirmLabel: "New link" }))) return;
    setShare(await createShare(user!.id, name));
    setNotice("New link ready.");
  });

  const stop = () => run(async () => {
    if (!(await confirm({ title: "Stop sharing?", message: "Your link stops working right away. You can share again later with a new link.", confirmLabel: "Stop sharing" }))) return;
    await stopSharing(user!.id);
    setShare(null);
  });

  const saveName = () => run(async () => {
    await renameShare(user!.id, name);
    setShare((s) => s && { ...s, name: name.trim() || null });
    setNotice("Name saved.");
  });

  async function send() {
    if (!share) return;
    const url = shareUrl(share.token);
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Pokémon card collection", text: "See which cards I have and which I’m still missing:", url });
      } else {
        await navigator.clipboard.writeText(url);
        setNotice("Link copied.");
        successFeedback();
      }
    } catch (e) {
      // Closing the share sheet isn't an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) setError("Couldn’t share. Copy the link instead.");
    }
  }

  async function copy() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(shareUrl(share.token));
      setNotice("Link copied.");
      successFeedback();
    } catch {
      setError("Couldn’t copy. Select the link and copy it yourself.");
    }
  }

  const nameDirty = !!share && (name.trim() || null) !== share.name;
  const primary = "w-full py-3 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";
  const secondary = "flex-1 py-3 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  return (
    <>
      <div className="fade-in fixed inset-0 z-50 bg-black/60" onClick={handleClose} aria-hidden="true" />

      {/* Bottom sheet on mobile → centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-sheet-title"
        className={`fixed z-50 bottom-0 inset-x-0 pb-[env(safe-area-inset-bottom)] md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out ${
          visible
            ? "translate-y-0 md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-100 md:scale-100"
            : "translate-y-full md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-0 md:scale-95"
        }`}
      >
        <div className="md:hidden mx-auto mt-3 mb-1 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden="true" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-gray-100" id="share-sheet-title">Share your collection</h2>
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {share
              ? "Anyone with this link can see your master sets: the cards you have and the ones you’re missing. It stays up to date as you collect. They can’t change anything."
              : "Get a link friends can open to see your master sets: the cards you have and the ones you’re missing. It stays up to date as you collect, and they don’t need an account. Your copies, prices paid and email stay private."}
          </p>

          <div>
            <label htmlFor="share-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Your name (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="share-name"
                type="text"
                value={name}
                maxLength={MAX_SHARE_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shown as “Name’s collection”"
                className="flex-1 min-w-0 px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              {nameDirty && (
                <button onClick={saveName} disabled={busy} className="px-4 min-h-[44px] rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold disabled:opacity-50">
                  Save
                </button>
              )}
            </div>
          </div>

          {share === undefined && !error && (
            <div className="flex justify-center py-4"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          )}

          {share && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Your link</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 break-all select-all">{shareUrl(share.token)}</p>
              <div className="flex gap-4 text-sm font-medium">
                <button onClick={copy} className="text-blue-600 dark:text-blue-400 hover:underline">Copy</button>
                <Link href={`/shared?c=${encodeURIComponent(share.token)}`} onClick={onClose} className="text-blue-600 dark:text-blue-400 hover:underline">Preview</Link>
              </div>
            </div>
          )}

          <div role="status" aria-live="polite">
            {notice && <p className="fade-in flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400"><CheckIcon className="w-4 h-4" />{notice}</p>}
            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
          </div>
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3 shrink-0">
          {share ? (
            <>
              <button onClick={send} disabled={busy} className={`${primary} flex items-center justify-center gap-2`}>
                <ShareIcon className="w-4 h-4" /> Send link
              </button>
              <div className="flex gap-3">
                <button onClick={renew} disabled={busy} className={secondary}>New link</button>
                <button onClick={stop} disabled={busy} className={secondary}>Stop sharing</button>
              </div>
            </>
          ) : (
            <button onClick={start} disabled={busy || share === undefined} className={primary}>
              {busy ? "Creating link…" : "Create link"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
