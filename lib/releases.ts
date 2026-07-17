// Novinky aplikace („Co je nového") a kroky uvítání pro nového uživatele.
// Zdroj pravdy je tento seznam v kódu (verzovaný v gitu) — žádná databáze ani
// administrace. Když se nasadí VIDITELNÁ změna (nová funkce / změna UI),
// přidá se sem nový záznam s vyšším `id`. Drobné opravy bez dopadu na uživatele
// novinku nedostávají. Viz outputs/co-je-noveho-a-napoveda-spec.md.

// Klíč, pod kterým si prohlížeč pamatuje poslední viděné vydání (bez DB).
export const LAST_SEEN_KEY = "ph-last-seen-release";

// Ikony novinek/kroků — klíč se v komponentě mapuje na konkrétní lucide ikonu
// (data soubor nesmí importovat React komponenty).
export type ReleaseIcon =
  | "sparkles"
  | "message"
  | "hash"
  | "flag"
  | "map"
  | "eye";

export type ReleaseItem = {
  icon: ReleaseIcon;
  title: string;
  description: string;
};

export type Release = {
  id: number; // vyšší = novější; podle něj se pozná, co uživatel neviděl
  date: string; // datum nasazení, český formát
  title: string; // krátký souhrn vydání
  items: ReleaseItem[];
};

// Vydání od nejnovějšího po nejstarší (nejnovější první).
export const RELEASES: Release[] = [
  {
    id: 1,
    date: "17. 7. 2026",
    title: "Přehlednější komentování",
    items: [
      {
        icon: "sparkles",
        title: "Reakce emoji",
        description:
          "Na komentář i odpověď můžete reagovat emoji (palec, fajfka, oči, srdce). Rychlé vyjádření souhlasu bez psaní.",
      },
      {
        icon: "hash",
        title: "Sjednocené počty komentářů",
        description:
          "Tlačítko i panel ukazují počet komentářů na aktuální stránce. Přepínač pro všechny stránky odhalí, kolik jich je jinde.",
      },
      {
        icon: "flag",
        title: "Odznak nevyřešených",
        description:
          "Na kartách projektů i dokumentů je hned vidět, kde čekají nevyřešené komentáře.",
      },
      {
        icon: "message",
        title: "Navádění v panelu",
        description:
          "Prázdný panel poradí, jak začít, a tlačítkem vás přepne do režimu komentování.",
      },
    ],
  },
];

// Nejnovější ID vydání (0 = žádná novinka). Podle něj se rozhoduje, zda okno
// „Co je nového" ukázat.
export const LATEST_RELEASE_ID = RELEASES.reduce(
  (max, r) => Math.max(max, r.id),
  0,
);

export type WelcomeStep = {
  icon: ReleaseIcon;
  title: string;
  description: string;
};

// Kroky uvítacího okna pro úplně nového uživatele (nemá smysl mu ukazovat
// seznam změn — uvidí, jak aplikace funguje).
export const WELCOME_STEPS: WelcomeStep[] = [
  {
    icon: "map",
    title: "Prohlédněte si specifikaci",
    description:
      "V režimu Procházení klikáte normálně (odkazy, tlačítka, modaly). Mezi stránkami se pohybujete drobečkovou navigací nahoře.",
  },
  {
    icon: "message",
    title: "Komentujte prvek",
    description:
      "Přepněte na Komentování, klikněte na prvek ve specifikaci a napište k němu komentář. U prvku se objeví špendlík.",
  },
  {
    icon: "flag",
    title: "Řešte vlákna",
    description:
      "V panelu odpovídáte, reagujete emoji a vlákna označujete jako vyřešená. Výchozí filtr ukazuje jen nevyřešené.",
  },
  {
    icon: "eye",
    title: "Nápověda po ruce",
    description:
      "Kdykoli otevřete Nápovědu v levém menu — najdete tam návod i přehled novinek.",
  },
];
