import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-pb/40 focus-visible:ring-offset-1 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  // Hlavní akce — firemní červená s jemným stínem, hover zjasní
  primary:
    "bg-pb text-white shadow-sm shadow-pb/25 hover:bg-pb-bright hover:shadow-md hover:shadow-pb/30",
  // Vedlejší akce — neutrální s rámečkem, hover jemně vyvýší
  secondary:
    "border border-line bg-bg-card text-ink shadow-sm hover:bg-line-soft hover:border-ink-4/40",
  // Destruktivní akce (mazání) — obrys, červená až po najetí
  danger:
    "border border-error/40 text-error hover:bg-error hover:border-error hover:text-white",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? "Načítám…" : children}
    </button>
  );
}
