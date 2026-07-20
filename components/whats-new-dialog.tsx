"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Eye,
  Flag,
  Hash,
  Map,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LAST_SEEN_KEY,
  LATEST_RELEASE_ID,
  RELEASES,
  WELCOME_STEPS,
  type Release,
  type ReleaseIcon,
} from "@/lib/releases";

// Událost pro ruční otevření okna „Co je nového" (tlačítko v Nápovědě).
export const OPEN_WHATS_NEW_EVENT = "ph:open-whats-new";

const ICONS: Record<ReleaseIcon, LucideIcon> = {
  sparkles: Sparkles,
  message: MessageSquare,
  hash: Hash,
  flag: Flag,
  map: Map,
  eye: Eye,
  bell: Bell,
};

type Mode = "welcome" | "whatsnew";
type PanelState = { open: boolean; mode: Mode; releases: Release[] };

// Okno po přihlášení: nový uživatel dostane UVÍTÁNÍ (jak aplikace funguje),
// vracející se uživatel „CO JE NOVÉHO" (jen novinky, které ještě neviděl).
// Rozhoduje se podle prohlížeče (localStorage), bez databáze. Mountuje se v
// AppShellu, takže je na všech přihlášených stránkách.
export function WhatsNewDialog() {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>({
    open: false,
    mode: "whatsnew",
    releases: [],
  });

  // Rozhodnutí při načtení — čte localStorage (jen v prohlížeči, po mountu, aby
  // nedošlo k hydration mismatch: okno je zprvu zavřené a otevře se až tady).
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(LAST_SEEN_KEY);
    } catch {
      return; // localStorage nedostupný (soukromý režim apod.) — nic neukazuj
    }
    let next: PanelState | null = null;
    if (raw === null) {
      // Nový uživatel → uvítání.
      next = { open: true, mode: "welcome", releases: [] };
    } else {
      const seen = Number(raw);
      const lastSeen = Number.isFinite(seen) ? seen : 0;
      if (lastSeen < LATEST_RELEASE_ID) {
        next = {
          open: true,
          mode: "whatsnew",
          releases: RELEASES.filter((r) => r.id > lastSeen),
        };
      }
    }
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- rozhodnutí závisí na localStorage, které je dostupné až po mountu (na serveru není)
      setPanel(next);
    }
  }, []);

  // Ruční otevření z Nápovědy — ukáže všechny novinky (celý přehled).
  useEffect(() => {
    function onOpen() {
      setPanel({ open: true, mode: "whatsnew", releases: RELEASES });
    }
    window.addEventListener(OPEN_WHATS_NEW_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WHATS_NEW_EVENT, onOpen);
  }, []);

  function close() {
    setPanel((p) => ({ ...p, open: false }));
  }

  // „Rozumím" = označit vše za viděné (uloží nejvyšší ID, ať se starší novinky
  // znovu neotvírají). Zavření křížkem / Esc jen odloží (neukládá).
  function acknowledge() {
    try {
      window.localStorage.setItem(LAST_SEEN_KEY, String(LATEST_RELEASE_ID));
    } catch {
      // localStorage nedostupný — okno se prostě příště ukáže znovu.
    }
    close();
  }

  function openHelp() {
    acknowledge();
    router.push("/napoveda");
  }

  return (
    <Dialog
      open={panel.open}
      onOpenChange={(o) => setPanel((p) => ({ ...p, open: o }))}
    >
      <DialogContent className="max-h-[85vh] w-[92vw] max-w-3xl overflow-y-auto sm:max-w-3xl">
        {panel.mode === "welcome" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles size={18} className="text-pb" aria-hidden="true" />
                Vítejte v ProductHubu
              </DialogTitle>
              <DialogDescription>
                Platforma pro připomínkování specifikací. Ve zkratce, jak na to:
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-3 py-1">
              {WELCOME_STEPS.map((step) => (
                <ItemRow
                  key={step.title}
                  icon={step.icon}
                  title={step.title}
                  description={step.description}
                />
              ))}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={openHelp}>
                Otevřít nápovědu
              </Button>
              <Button onClick={acknowledge}>Rozumím</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles size={18} className="text-pb" aria-hidden="true" />
                Co je nového
              </DialogTitle>
              {panel.releases[0] && (
                <DialogDescription>{panel.releases[0].date}</DialogDescription>
              )}
            </DialogHeader>
            <div className="space-y-4 py-1">
              {panel.releases.map((release) => (
                <div key={release.id} className="space-y-3">
                  {panel.releases.length > 1 && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {release.date} — {release.title}
                    </p>
                  )}
                  <ul className="space-y-3">
                    {release.items.map((item) => (
                      <ItemRow
                        key={item.title}
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={acknowledge}>Rozumím</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  icon,
  title,
  description,
}: {
  icon: ReleaseIcon;
  title: string;
  description: string;
}) {
  const Icon = ICONS[icon];
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
