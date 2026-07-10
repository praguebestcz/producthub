"use client";
import { useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info as InfoIcon,
  LucideIcon,
  X,
} from "lucide-react";

// Nenápadné oznámení (toast) v pravém horním rohu. Samo zmizí po `duration` ms,
// jde zavřít křížkem. (Vzor vratky.)
const ICONS: Record<
  "success" | "info" | "danger",
  { color: string; Icon: LucideIcon }
> = {
  success: { color: "text-[#1a8a4d]", Icon: CheckCircle2 },
  info: { color: "text-ink", Icon: InfoIcon },
  danger: { color: "text-pb", Icon: AlertCircle },
};

export function Toast({
  open,
  message,
  tone = "success",
  onClose,
  duration = 4500,
}: {
  open: boolean;
  message: string;
  tone?: "success" | "info" | "danger";
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;
  const ic = ICONS[tone];
  const Icon = ic.Icon;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex max-w-[calc(100vw-2rem)] justify-end">
      <div
        role="status"
        className="ph-animate-toast pointer-events-auto flex w-80 max-w-full items-start gap-3 rounded-xl border border-line bg-bg-card px-4 py-3 shadow-lg"
      >
        <Icon
          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${ic.color}`}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm font-medium leading-snug text-ink">
          {message}
        </span>
        <button
          onClick={onClose}
          aria-label="Zavřít"
          className="-mr-1 flex-shrink-0 rounded p-0.5 text-ink-3 transition hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
