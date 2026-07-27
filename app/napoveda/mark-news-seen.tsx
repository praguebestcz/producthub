"use client";

import { useEffect } from "react";
import {
  LAST_SEEN_KEY,
  LATEST_RELEASE_ID,
  NEWS_SEEN_EVENT,
  WHATSNEW_SHOWN_KEY,
} from "@/lib/releases";

// Otevření Nápovědy = uživatel viděl novinky (jsou tu v „Historii novinek") →
// označíme je za viděné a skryjeme odznak u Nápovědy v menu. Bez UI (jen efekt).
export function MarkNewsSeen() {
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, String(LATEST_RELEASE_ID));
      window.localStorage.setItem(WHATSNEW_SHOWN_KEY, String(LATEST_RELEASE_ID));
      window.dispatchEvent(new Event(NEWS_SEEN_EVENT));
    } catch {
      // localStorage nedostupný — nevadí
    }
  }, []);
  return null;
}
