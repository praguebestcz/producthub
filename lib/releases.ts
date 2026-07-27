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
  | "eye"
  | "bell"
  | "users";

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
    id: 16,
    date: "27. 7. 2026",
    title: "Přehlednější úpravy a mazání komentáře",
    items: [
      {
        icon: "message",
        title: "Upravit a smazat v menu ⋮",
        description:
          "Úprava a mazání vlastního komentáře jsou nově v kebab menu (tři tečky ⋮ vpravo u komentáře, vzor Google komentářů) - dřív to byly malé nenápadné odkazy. Smazání potvrdíte dialogem.",
      },
    ],
  },
  {
    id: 15,
    date: "27. 7. 2026",
    title: "Špendlíky jako v Google komentářích",
    items: [
      {
        icon: "message",
        title: "Špendlík ukazuje počet zpráv, ne pořadí",
        description:
          "Špendlík u prvku ukazuje avatar autora a - jen u vlákna s odpověďmi - počet zpráv ve vláknu (místo dřívějšího pořadového čísla, které nic neříkalo).",
      },
      {
        icon: "hash",
        title: "Přehled komentářů nic nezvýrazňuje",
        description:
          "Když otevřete přehled všech komentářů, žádný prvek už nezůstane zvýrazněný - zvýraznění patří jen ke konkrétnímu otevřenému vláknu.",
      },
    ],
  },
  {
    id: 14,
    date: "27. 7. 2026",
    title: "Proklik zvýrazní prvek + jednotné barvy",
    items: [
      {
        icon: "message",
        title: "Proklik označí prvek v dokumentu",
        description:
          "Po prokliku z e-mailu nebo zvonečku se teď kromě komentáře zvýrazní i jeho HTML prvek přímo ve specifikaci - zůstane označený, dokud nekliknete jinam.",
      },
      {
        icon: "users",
        title: "Barva uživatele ladí všude",
        description:
          "Barva kolem avataru u komentáře odpovídá barvě v liště přítomnosti - poznáte tak autora napříč dokumentem. Pokud má uživatel vlastní avatar, zobrazí se.",
      },
    ],
  },
  {
    id: 13,
    date: "27. 7. 2026",
    title: "E-mailová upozornění",
    items: [
      {
        icon: "bell",
        title: "Upozornění i do e-mailu",
        description:
          "V Nastavení si zapnete e-maily: Okamžitě (hned po události), nebo Jen nepřečtené (chytře - e-mail dorazí jen na to, co jste si v aplikaci nestihli přečíst, žádný spam). Výchozí je Vypnuto. E-maily platí stejný rozsah jako zvoneček (vše / jen zapojen).",
      },
    ],
  },
  {
    id: 12,
    date: "27. 7. 2026",
    title: "Živý zvoneček",
    items: [
      {
        icon: "bell",
        title: "Upozornění naskočí okamžitě",
        description:
          "Zvoneček se aktualizuje živě - nová odpověď, @zmínka nebo změna stavu vlákna se objeví hned, bez obnovení stránky a bez čekání. Když se nic neděje, nic to nezatěžuje.",
      },
    ],
  },
  {
    id: 11,
    date: "27. 7. 2026",
    title: "Sbalitelné skupiny klientů",
    items: [
      {
        icon: "flag",
        title: "Přehlednější seznam projektů",
        description:
          "V seznamu projektů jde každou skupinu klienta sbalit a rozbalit; nastavení si aplikace zapamatuje. Při více klientech jsou skupiny po načtení sbalené, při jediném klientovi rozbalené. I ve sbaleném stavu je na hlavičce vidět počet projektů a odznak nevyřešených.",
      },
    ],
  },
  {
    id: 10,
    date: "27. 7. 2026",
    title: "Přehled (samostatná stránka)",
    items: [
      {
        icon: "map",
        title: "Souhrn a poslední aktivita",
        description:
          "V levém menu přibyl Přehled: souhrn (otevřené komentáře, čekající zadání, upozornění pro vás, projekty) a feed poslední aktivity napříč projekty - nové komentáře, odpovědi, zmínky a vyřešená vlákna, s proklikem rovnou ke komentáři. Seznam projektů zůstává samostatně.",
      },
    ],
  },
  {
    id: 9,
    date: "22. 7. 2026",
    title: "Úprava a mazání komentáře",
    items: [
      {
        icon: "message",
        title: "Upravit / smazat vlastní komentář",
        description:
          "Svůj komentář nebo odpověď teď můžete upravit i smazat (v nejnovější verzi). Vlákno s odpověďmi se nemaže, aby se neztratila cizí diskuse - jde upravit text.",
      },
    ],
  },
  {
    id: 8,
    date: "22. 7. 2026",
    title: "Komentáře přežijí novou verzi",
    items: [
      {
        icon: "message",
        title: "Přenos komentářů mezi verzemi",
        description:
          "Při nahrání nové verze specifikace se nevyřešené komentáře přenesou na odpovídající prvky (v dialogu Nová verze to jde vypnout). Prvek, který v nové verzi zmizel, se označí. Starší verze jsou nově jen ke čtení.",
      },
    ],
  },
  {
    id: 7,
    date: "21. 7. 2026",
    title: "Živé komentáře",
    items: [
      {
        icon: "message",
        title: "Komentáře bez obnovení stránky",
        description:
          "Když někdo jiný přidá komentář, odpoví nebo změní stav vlákna, objeví se vám to u dokumentu živě - nemusíte mačkat F5.",
      },
    ],
  },
  {
    id: 6,
    date: "21. 7. 2026",
    title: "Volba upozornění",
    items: [
      {
        icon: "bell",
        title: "Kdy vám chodí upozornění",
        description:
          "V Nastavení (menu u vašeho jména dole) si zvolíte, zda chcete upozornění na veškeré dění v dokumentech, nebo jen když jste zapojeni - někdo vás @zmíní nebo odpoví ve vašem vláknu.",
      },
    ],
  },
  {
    id: 5,
    date: "20. 7. 2026",
    title: "Přítomnost u dokumentu",
    items: [
      {
        icon: "users",
        title: "Kdo je právě u dokumentu",
        description:
          "V liště dokumentu vidíte avatary lidí, kteří ho mají otevřený (každý má svou barvu). Když někdo píše komentář, jeho avatar se ukáže přímo u daného prvku na stránce a u vlákna v panelu. Kliknutím na avatar píšícího skočíte rovnou na prvek, kde píše. Externí recenzent nikdy nevidí interní tým.",
      },
    ],
  },
  {
    id: 4,
    date: "20. 7. 2026",
    title: "Upozornění (zvoneček)",
    items: [
      {
        icon: "bell",
        title: "Zvoneček s upozorněními",
        description:
          "V horní liště přibyl zvoneček. Upozorní vás na odpovědi ve vašich vláknech, na @zmínky i na změny stavu vláken, kterých se účastníte.",
      },
      {
        icon: "message",
        title: "Proklik rovnou ke komentáři",
        description:
          "Kliknutím na upozornění přejdete přímo k danému komentáři v dokumentu. Přečtená upozornění se odečtou z počtu.",
      },
    ],
  },
  {
    id: 3,
    date: "20. 7. 2026",
    title: "Ochrana osobních údajů",
    items: [
      {
        icon: "eye",
        title: "Zásady zpracování osobních údajů",
        description:
          "Přibyla stránka se zásadami zpracování (odkaz na přihlašovací obrazovce): kdo je správce, jaké údaje se zpracovávají a komu se předávají.",
      },
    ],
  },
  {
    id: 2,
    date: "20. 7. 2026",
    title: "Prompt z komentářů pro Claude Code",
    items: [
      {
        icon: "sparkles",
        title: "Z komentářů rovnou prompt",
        description:
          "Vyberte komentáře (nebo u jednoho klikněte na Vytvořit prompt) a AI z nich vyvodí konkrétní změny - hotový prompt pro Claude Code. Jen interní tým.",
      },
      {
        icon: "message",
        title: "Doplnění a přegenerování",
        description:
          "Co AI označí k upřesnění, doplníte přímo v textu, nebo napíšete odpověď a necháte AI prompt přegenerovat.",
      },
      {
        icon: "flag",
        title: "Předaná zadání se stavy",
        description:
          "Vytvořené prompty se ukládají jako zadání se stavem Vytvořeno → Předáno vývoji → Zapracováno. Jdou kopírovat, stáhnout jako .md i smazat.",
      },
      {
        icon: "hash",
        title: "Celá specifikace v panelu",
        description:
          "Komentáře z celé specifikace máte v panelu pohromadě, bez přepínání po stránkách.",
      },
    ],
  },
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
