import Link from "next/link";

// Zásady zpracování osobních údajů — veřejná stránka (i bez přihlášení).
// Text obsahuje místa [doplní PragueBest] pro právní specifika (kontakt,
// smluvní záruky, retenční lhůty) — ty potvrdí/doplní PragueBest.
export const metadata = {
  title: "Zásady zpracování osobních údajů — ProductHub",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Zásady zpracování osobních údajů
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Jak ProductHub nakládá s osobními údaji. Aplikaci provozuje agentura
        PragueBest pro sdílení a připomínkování specifikací.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold">Správce údajů</h2>
          <p className="mt-1 text-muted-foreground">
            PragueBest s.r.o. Kontakt pro dotazy a uplatnění práv:
            [doplní PragueBest — e-mail].
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Jaké údaje zpracováváme</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Identita z účtu Google: e-mail, jméno, profilová fotka.</li>
            <li>Členství v projektech a role (autor, komentátor, čtenář).</li>
            <li>Obsah, který vytvoříte: komentáře, odpovědi, zmínky.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Účel a právní základ</h2>
          <p className="mt-1 text-muted-foreground">
            Údaje zpracováváme kvůli provozu aplikace pro připomínkování
            specifikací (plnění smlouvy a oprávněný zájem provozovatele na
            fungování služby). [doplní PragueBest — upřesnění právního základu].
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Komu údaje předáváme (zpracovatelé)</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong>Google</strong> — přihlášení (ověření identity).
            </li>
            <li>
              <strong>Anthropic</strong> (USA) — při vytváření zadání pro vývoj
              se text komentářů zpracovává jazykovým modelem Claude. Jména
              recenzentů se do modelu neposílají.
            </li>
            <li>
              <strong>Railway</strong> — hosting aplikace a databáze.
            </li>
            <li>
              <strong>Sentry</strong> (self-hosted u PragueBest) — monitoring
              chyb aplikace.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">Přenos mimo EU</h2>
          <p className="mt-1 text-muted-foreground">
            Anthropic (a případně Google) zpracovávají údaje i mimo EU (USA).
            Přenos probíhá na základě odpovídajících záruk. [doplní PragueBest —
            konkrétní záruky, např. standardní smluvní doložky].
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Doba uchování</h2>
          <p className="mt-1 text-muted-foreground">
            Údaje uchováváme po dobu využívání aplikace. [doplní PragueBest —
            konkrétní retenční lhůty].
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Vaše práva</h2>
          <p className="mt-1 text-muted-foreground">
            Máte právo na přístup k údajům, jejich opravu, výmaz, omezení
            zpracování a námitku. Na žádost o výmaz účet anonymizujeme (osobní
            údaje se odstraní, obsah zůstane pod anonymním autorem kvůli
            konzistenci historie). Uplatnění práv: [doplní PragueBest — kontakt].
          </p>
        </section>
      </div>

      <div className="mt-10 border-t pt-6 text-sm">
        <Link href="/login" className="text-pb hover:underline">
          ← Zpět na přihlášení
        </Link>
      </div>
    </main>
  );
}
