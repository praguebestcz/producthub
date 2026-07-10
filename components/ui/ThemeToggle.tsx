"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Přepínač světlý/tmavý režim přes next-themes (stejný systém používá
// i shadcn Toaster). Ikona se čte až po hydrataci — na serveru se kreslí
// měsíček, aby nedošlo k rozjetí HTML (hydration mismatch).
const subscribeNoop = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
