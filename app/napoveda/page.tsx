import { redirect } from "next/navigation";
import {
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
      "Tlačítko Komentáře ukazuje počet na aktuální stránce; přepínač Všechny stránky odhalí zbytek.",
    ],
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
