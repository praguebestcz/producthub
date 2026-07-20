"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

// Přepínač panelu v horní liště. Ukazuje se JEN když je panel sbalený (nebo na
// mobilu) — když je panel otevřený, sbalení je tlačítkem uvnitř panelu (u loga),
// ne vedle něj v liště (přání Hany).
export function HeaderSidebarToggle() {
  const { state, isMobile } = useSidebar();
  if (state === "expanded" && !isMobile) return null;
  return (
    <>
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 !h-4" />
    </>
  );
}
