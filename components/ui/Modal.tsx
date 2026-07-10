"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

// Vyskakovací okno (modal) s rozostřeným překryvem. Zavře se křížkem, klávesou Esc
// nebo klikem mimo. Responzivní: na mobilu zespodu (sheet), na desktopu vycentrovaná
// karta. (Vzor vratky, bez embed postMessage — ProductHub neběží v cizím iframe.)
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      {/* překryv (klik mimo = zavřít) */}
      <div
        className="ph-animate-fade absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* okno: mobil sheet zespodu, desktop vycentrovaná karta */}
      <div
        role="dialog"
        aria-modal="true"
        className="ph-animate-modal relative z-10 flex w-full max-w-md flex-col overflow-y-auto rounded-t-2xl bg-bg-card p-6 shadow-2xl ring-1 ring-black/5 sm:max-h-[90vh] sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-ink-3 transition hover:bg-line-soft hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {title && (
          <h2 className="mb-2 pr-8 text-xl font-semibold text-ink">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
