"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OPEN_WHATS_NEW_EVENT } from "@/components/whats-new-dialog";

// Znovu vyvolá okno „Co je nového" (posluchač je ve WhatsNewDialog v AppShellu).
export function ShowWhatsNewButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT))}
    >
      <Sparkles />
      Zobrazit poslední novinky
    </Button>
  );
}
