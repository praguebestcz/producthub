import { redirect } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Eye,
  Flag,
  Hash,
  Lock,
  Map,
  MessageSquare,
  MousePointer2,
  Smile,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ShowWhatsNewButton } from "@/components/show-whats-new-button";
import { RELEASES, type ReleaseIcon } from "@/lib/releases";

// Ikony novinek (stejné klíče jako v lib/releases.ts).
const RELEASE_ICONS: Record<ReleaseIcon, LucideIcon> = {
  sparkles: Sparkles,
  message: MessageSquare,
  hash: Hash,
  flag: Flag,
  map: Map,
  eye: Eye,
  bell: Bell,
  users: Users,
};

// Návod k použití — témata krok za krokem.
const GUIDE: { icon: LucideIcon; title: string; points: string[] }[] = [
  {
    icon: MousePointer2,
    title: "Prohlížení specifikace",
    points: [
      "V režimu Procházení funguje specifikace normálně — klikáte na odkazy, tlačítka i modaly.",
      "Mezi stránkami se pohybujete drobečkovou navigací nad dokumentem.",
      "Nahoře přepínáte verze dokumentu; komentáře se vždy vážou ke zvolené verzi.",
    ],
  },
  {
    icon: MessageSquare,
    title: "Komentování prvků",
    points: [
      "Přepněte na režim Komentování. Kliknutím vyberete konkrétní prvek ve specifikaci.",
      "U prvku se otevře bublina — napíšete komentář a uložíte. Vznikne špendlík s číslem.",
      "Jeden prvek má jedno vlákno; další příspěvky k němu jsou odpovědi.",
    ],
  },
  {
    icon: CheckCircle2,
    title: "Vlákna, odpovědi a řešení",
    points: [
      "V panelu vpravo odpovídáte na vlákna a označujete je jako Vyřešené (nebo je znovu otevřete).",
      "Filtr nahoře přepíná Nevyřešené / Vyřešené / Vše. Výchozí je Nevyřešené.",
      "Špendlíky na stránce se řídí stejným filtrem — vyřešené se běžně nezobrazují.",
    ],
  },
  {
    icon: Smile,
    title: "Reakce a zmínky",
    points: [
      "Na komentář i odpověď můžete reagovat emoji (👍 ✅ 👀 ❤️) — rychlé vyjádření bez psaní.",
      "Napsáním @ zmíníte člena projektu; našeptávač nabídne jen členy daného projektu.",
    ],
  },
  {
    icon: Bell,
    title: "Upozornění (zvoneček)",
    points: [
      "Zvoneček v pravém horním rohu ukazuje počet nepřečtených upozornění.",
      "Upozorní vás na odpověď ve vašem vláknu, na @zmínku i na změnu stavu vlákna, kterého se účastníte.",
      "Kliknutím na upozornění přejdete rovnou k danému komentáři; tlačítkem Označit vše přečtené počet vynulujete.",
    ],
  },
  {
    icon: Users,
    title: "Přítomnost u dokumentu",
    points: [
      "V liště dokumentu vidíte avatary lidí, kteří ho mají zrovna otevřený - každý má svou barvu.",
      "Když někdo píše komentář, jeho avatar se ukáže přímo u daného prvku na stránce (podle barvy poznáte kdo); taky u avataru v liště a u vlákna v panelu.",
      "Kliknutím na avatar píšícího v liště skočíte rovnou na prvek, kde právě píše (i na jiné stránce).",
      "Externí recenzent (klient) nikdy nevidí interní tým PragueBest ani jeho aktivitu.",
    ],
  },
  {
    icon: Lock,
    title: "Interní vs. veřejné komentáře",
    points: [
      "Veřejný komentář vidí všichni členové projektu včetně klienta.",
      "Interní komentář vidí jen interní tým PragueBest — klientovi se nikdy nezobrazí.",
      "Odpověď pod interním vláknem je vždy interní (nemůže uniknout ven).",
    ],
  },
  {
    icon: Flag,
    title: "Kde je vidět práce",
    points: [
      "Na kartách projektů i dokumentů je odznak s počtem nevyřešených komentářů.",
      "Panel komentářů ukazuje komentáře z celé specifikace pohromadě (bez přepínání po stránkách).",
    ],
  },
  {
    icon: Sparkles,
    title: "Prompt z komentářů pro Claude Code (interní tým)",
    points: [
      "Z komentářů vytvoříte prompt pro vývoj: v panelu zaškrtnete komentáře (nebo kliknete Vytvořit prompt přímo u jednoho).",
      "AI z připomínek a diskuse vyvodí konkrétní změny. Co není jasné, označí k upřesnění - doplníte přímo v textu nebo napíšete odpověď a necháte přegenerovat.",
      "Prompt uložíte jako zadání (stav Vytvořeno / Předáno vývoji / Zapracováno), zkopírujete nebo stáhnete jako .md. Přehled v tlačítku Zadání.",
    ],
  },
];

// Zvýrazněné místo ve screenshotu Nápovědy: rámeček + číslo, popisek je v
// legendě pod obrázkem. Pozice v % (nezávislé na velikosti) — při větší změně
// UI je nutné screenshot přefotit (viz pravidlo „živá Nápověda" v AGENTS.md).
type Spot = { l: number; t: number; w: number; h: number; label: string };

function HelpShot({
  src,
  alt,
  spots,
}: {
  src: string;
  alt: string;
  spots: Spot[];
}) {
  return (
    <figure className="mt-4 overflow-hidden rounded-xl border">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full" />
        {spots.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-md ring-2 ring-pb ring-offset-1 ring-offset-white/40"
            style={{
              left: `${s.l}%`,
              top: `${s.t}%`,
              width: `${s.w}%`,
              height: `${s.h}%`,
            }}
          >
            <span className="absolute -top-2.5 -left-2.5 flex size-5 items-center justify-center rounded-full bg-pb text-[11px] font-bold text-white shadow">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {spots.map((s, i) => (
          <span key={i}>
            <strong className="text-foreground">{i + 1}.</strong> {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

// Zvýrazněná místa v prohlížeči dokumentu (pozice odpovídají public/napoveda/prohlizec.png).
const VIEWER_SPOTS: Spot[] = [
  { l: 68.5, t: 17.8, w: 17.2, h: 5.6, label: "Přepínač Procházení / Komentování" },
  { l: 85.6, t: 18.6, w: 13.2, h: 4.2, label: "Panel komentářů a Předaná zadání" },
  {
    l: 76.6,
    t: 49.6,
    w: 3.4,
    h: 3.6,
    label: "Zaškrtávátka — výběr komentářů do promptu",
  },
];

// Nápověda — návod k použití + přehled novinek. Dostupná všem přihlášeným.
export default async function NapovedaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <PageHeader
        title="Nápověda"
        description="Návod k použití a přehled novinek v aplikaci."
      />

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">
          Jak aplikaci používat
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kde co v prohlížeči dokumentu najdete:
        </p>
        <HelpShot
          src="/napoveda/prohlizec.png"
          alt="Prohlížeč dokumentu se zvýrazněnými ovládacími prvky"
          spots={VIEWER_SPOTS}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {GUIDE.map((topic) => (
            <Card key={topic.title}>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
                    <topic.icon size={18} aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{topic.title}</h3>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {topic.points.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50"
                        aria-hidden="true"
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Historie novinek
          </h2>
          <ShowWhatsNewButton />
        </div>
        {RELEASES.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Zatím žádné novinky.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {RELEASES.map((release) => (
              <Card key={release.id}>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="font-semibold">{release.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {release.date}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {release.items.map((item) => {
                      const Icon = RELEASE_ICONS[item.icon];
                      return (
                        <li key={item.title} className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-pb-soft text-pb">
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
