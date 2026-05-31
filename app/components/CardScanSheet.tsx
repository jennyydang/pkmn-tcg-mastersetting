"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { PokemonCard } from "@/lib/types";
import { searchCards } from "@/lib/api";
import { SearchIcon, XIcon } from "@/app/components/Icons";

declare global {
  interface Window {
    BarcodeDetector?: {
      new(opts?: { formats: string[] }): {
        detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
      };
    };
  }
}

interface Props {
  onAdd: (card: PokemonCard) => void;
  onClose: () => void;
  isInCollection: (cardId: string) => boolean;
}

export default function CardScanSheet({ onAdd, onClose, isInCollection }: Props) {
  const [visible, setVisible]               = useState(false);
  const [cameraError, setCameraError]       = useState(false);
  const [query, setQuery]                   = useState("");
  const [results, setResults]               = useState<PokemonCard[]>([]);
  const [searching, setSearching]           = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectorRef   = useRef<InstanceType<NonNullable<Window["BarcodeDetector"]>> | null>(null);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Start camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError(true);
      }
    }
    startCamera();

    // Init BarcodeDetector if available
    if (typeof window !== "undefined" && window.BarcodeDetector) {
      try {
        detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39"] });
      } catch {
        // BarcodeDetector not supported
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchCards(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const handleCanPlay = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return;
    if (intervalRef.current) return; // already started
    intervalRef.current = setInterval(async () => {
      if (!detectorRef.current || !videoRef.current) return;
      // Only scan if query is currently empty
      if (query) return;
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue.slice(0, 80);
          setQuery(raw);
        }
      } catch {
        // detection error, ignore
      }
    }, 600);
  }, [query]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan or search for a card"
        className={`fixed z-50 bottom-0 inset-x-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col max-h-[92dvh] transition-transform duration-300 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="mx-auto mt-3 mb-1 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Scan or Search</h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <XIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 pb-6">
          {/* Camera preview */}
          <div className="relative bg-black rounded-xl mx-4 mt-2 overflow-hidden aspect-[4/3]">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-900">
                <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <p className="text-sm text-gray-400 text-center px-4">Camera unavailable · use search below</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onCanPlay={handleCanPlay}
                  className="w-full h-full object-cover"
                />
                {/* Scan guide overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="w-48 h-32 border-2 border-white/50 rounded-lg" />
                  <p className="mt-2 text-xs text-white/70">Hold card steady to scan</p>
                </div>
              </>
            )}
          </div>

          {/* Search input */}
          <div className="px-4 mt-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or card number…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-label="Search cards"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-label="Searching" />
              )}
            </div>
          </div>

          {/* Results list */}
          {results.length > 0 && (
            <div className="px-4 mt-3 space-y-2">
              {results.map((card) => {
                const inCol = isInCollection(card.id);
                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 p-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800"
                  >
                    <div className="shrink-0 w-9 h-[50px] relative rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <Image
                        src={card.images.small}
                        alt={card.name}
                        fill
                        className="object-cover"
                        unoptimized
                        sizes="36px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{card.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {card.set.name} · #{card.number}
                      </p>
                    </div>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!inCol) onAdd(card);
                      }}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        inCol
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                      disabled={inCol}
                      aria-label={inCol ? `${card.name} already in collection` : `Add ${card.name} to collection`}
                    >
                      {inCol ? "Added ✓" : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty results state */}
          {!searching && query.trim() && results.length === 0 && (
            <p className="text-sm text-center text-gray-400 dark:text-gray-500 mt-6 px-4">
              No cards found for &ldquo;{query}&rdquo;
            </p>
          )}
        </div>
      </div>
    </>
  );
}
