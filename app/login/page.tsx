import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Logo } from "@/components/ui/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Chybové hlášky pro ?error= z OAuth callbacku — česky a srozumitelně.
const ERRORS: Record<string, string> = {
  "google-denied": "Přihlášení bylo zrušeno. Zkuste to prosím znovu.",
  "state-mismatch":
    "Přihlášení vypršelo nebo bylo přerušeno. Zkuste to prosím znovu.",
  "email-conflict":
    "Tento e-mail už patří jinému účtu. Kontaktujte prosím správce aplikace.",
  "account-deactivated":
    "Tento účet byl deaktivován. Kontaktujte prosím správce aplikace.",
  "google-failed":
    "Přihlášení přes Google se nepovedlo. Zkuste to prosím znovu.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Přihlášeného uživatele pošleme rovnou na dashboard.
  if (await getSessionUser()) redirect("/");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERRORS[error] ?? ERRORS["google-failed"])
    : null;

  return (
    <main className="relative flex flex-1 items-center justify-center p-6">
      {/* Dekorativní barevné záře v pozadí */}
      <div className="ph-login-bg" aria-hidden="true" />

      <div className="relative w-full max-w-sm">
        <Card className="shadow-[var(--shadow-pop)]">
          <CardContent className="pt-2">
            <div className="flex flex-col items-center text-center">
              <Logo size="lg" />
              <h1 className="mt-6 text-xl font-semibold tracking-tight">
                Vítejte zpět
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Připomínkování a revize HTML specifikací
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive" className="mt-6">
                <AlertCircle />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <a
              href="/api/auth/google"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-8 w-full",
              )}
            >
              {/* Google logo (oficiální barvy, inline SVG) */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Přihlásit se přes Google
            </a>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Do projektů se dostanete až po pozvání jejich autorem.
          <br />
          Přihlášením nevzniká žádný přístup navíc.
        </p>
      </div>
    </main>
  );
}
