"use client";
import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

// Přepínač světlý/tmavý režim. Ukládá volbu do localStorage ('ph-theme')
// a přepíná třídu 'dark' na <html>. Výchozí je světlý.
//
// Stav se čte přímo z DOM přes useSyncExternalStore (MutationObserver na
// atribut class) — žádný lokální state ani efekt, takže nehrozí rozjetí
// mezi třídou na <html> a ikonou.

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  // Na serveru (SSR) vždy světlý — skript v <head> přepne třídu před vykreslením.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ph-theme", next ? "dark" : "light");
    } catch {
      /* localStorage nedostupné — ignoruj */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-line-soft hover:text-ink"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
