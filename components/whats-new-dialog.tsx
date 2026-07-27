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
  Users,
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
  WHATSNEW_SHOWN_KEY,
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
  users: Users,
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
    let seenRaw: string | null;
    let shownRaw: string | null;
    try {
      seenRaw = window.localStorage.getItem(LAST_SEEN_KEY);
      shownRaw = window.localStorage.getItem(WHATSNEW_SHOWN_KEY);
    } catch {
      return; // localStorage nedostupný (soukromý režim apod.) — nic neukazuj
    }

    // Zapamatuj, že se okno pro tuhle nejnovější verzi UŽ ukázalo → víckrát
    // automaticky nevyskočí (ani po přechodu mezi stránkami / refreshi).
    const markShown = () => {
      try {
        window.localStorage.setItem(
          WHATSNEW_SHOWN_KEY,
          String(LATEST_RELEASE_ID),
        );
      } catch {
        // ignoruj — bez uložení se ukáže příště znovu (lepší než nic)
      }
    };

    let next: PanelState | null = null;
    if (seenRaw === null && shownRaw === null) {
      // Úplně nový uživatel → uvítání (jen jednou).
      next = { open: true, mode: "welcome", releases: [] };
      markShown();
    } else {
      const seen = Number(seenRaw);
      const lastSeen = Number.isFinite(seen) ? seen : 0;
      const shown = Number(shownRaw);
      const lastShown = Number.isFinite(shown) ? shown : 0;
      // Vyskočí jen JEDNOU pro danou nejnovější verzi a jen když uživatel
      // novinky ještě neoznačil za viděné.
      if (lastShown < LATEST_RELEASE_ID && lastSeen < LATEST_RELEASE_ID) {
        next = {
          open: true,
          mode: "whatsnew",
          releases: RELEASES.filter((r) => r.id > lastSeen),
        };
        markShown();
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

  // „Rozumím" jen zavře okno (a pojistně potvrdí, že se pro tuhle verzi ukázalo,
  // ať znovu nevyskočí). Odznak u Nápovědy schválně NEschovává - okno je jen
  // jednorázové oznámení a odznak zůstane jako připomínka, dokud uživatel
  // neotevře Nápovědu (tam je celý přehled novinek).
  function acknowledge() {
    try {
      window.localStorage.setItem(WHATSNEW_SHOWN_KEY, String(LATEST_RELEASE_ID));
    } catch {
      // localStorage nedostupný — nevadí.
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
