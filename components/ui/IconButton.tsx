import { ButtonHTMLAttributes, ReactNode } from "react";

// Malé čtvercové tlačítko jen s ikonou — akce v řádku tabulky (např. detail).
// Jemný šedý rámeček, po najetí myší zčervená (firemní akcent). (Vzor vratky.)
export function IconButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-pb transition-colors hover:border-pb hover:bg-pb-soft focus:outline-none focus:ring-2 focus:ring-pb/30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
