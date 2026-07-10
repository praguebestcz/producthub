import { APP_NAME, APP_DESCRIPTION } from "@/lib/app-info";

// Dočasná úvodní stránka (milník M0) — nahradí ji seznam projektů (M3).
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-3 text-ink-2">{APP_DESCRIPTION}</p>
        <p className="mt-8 text-sm text-ink-4">
          Milník M0 — kostra projektu. Přihlášení a projekty přijdou v dalších
          milnících.
        </p>
      </div>
    </main>
  );
}
