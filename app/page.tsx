import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

// Dashboard — po přihlášení. Seznam projektů přijde v M3; zatím prázdný stav.
export default async function Home() {
  const user = await getSessionUser();
  // Proxy nepřihlášené přesměruje už dřív; tohle je pojistka (obrana do hloubky).
  if (!user) redirect("/login");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Projekty</h1>

        <div className="mt-8 rounded-xl border border-dashed border-line bg-bg-card p-10 text-center">
          {user.canCreateProjects ? (
            <p className="text-ink-3">
              Zatím tu nejsou žádné projekty. Založení projektu přijde
              v milníku M3.
            </p>
          ) : (
            <p className="text-ink-3">
              Zatím nevidíte žádné projekty. Počkejte, až vás autor projektu
              pozve — pak se projekt objeví tady.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
