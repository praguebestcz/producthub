import { redirect } from "next/navigation";
import { FolderOpen, MailOpen } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

// Dashboard — po přihlášení. Seznam projektů přijde v M3; zatím prázdný stav.
export default async function Home() {
  const user = await getSessionUser();
  // Proxy nepřihlášené přesměruje už dřív; tohle je pojistka (obrana do hloubky).
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <PageHeader
        title="Projekty"
        description="Specifikace, prototypy a wireframy k připomínkování."
      />

      {/* Prázdný stav — ikona v měkkém kruhu, vysvětlení dalšího kroku */}
      <Card className="mt-10 border-dashed">
        <CardContent className="flex flex-col items-center px-8 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pb-soft text-pb">
            {user.canCreateProjects ? (
              <FolderOpen size={26} strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <MailOpen size={26} strokeWidth={1.8} aria-hidden="true" />
            )}
          </span>
          {user.canCreateProjects ? (
            <>
              <h2 className="mt-5 text-lg font-semibold">
                Zatím žádné projekty
              </h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Založení prvního projektu přijde v milníku M3 — pak sem
                nahrajete specifikaci a pozvete recenzenty.
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-lg font-semibold">Čekáte na pozvánku</h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Zatím nevidíte žádné projekty. Jakmile vás autor projektu pozve,
                projekt se objeví tady.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
