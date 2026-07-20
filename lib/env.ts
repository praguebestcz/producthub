// Validace povinných proměnných prostředí — fail-fast s čitelnou chybou
// místo nečitelného pádu hluboko za běhu. Volá se lazy (až když je proměnná
// potřeba), aby build bez .env nespadl. (Vzor vratky.)

function required(
  name: string,
  validate: (v: string) => boolean,
  hint: string,
): string {
  const v = process.env[name];
  if (!v || !validate(v)) {
    throw new Error(
      `Proměnná prostředí ${name} chybí nebo je neplatná (${hint}).`,
    );
  }
  return v;
}

export const getJwtSecret = () =>
  required("JWT_SECRET", (v) => v.length >= 32, "min. 32 znaků");

// Klíč pro šifrování tajemství v DB (Anthropic API klíč). Samostatná proměnná,
// NE odvozená z JWT_SECRET — ten se rotuje (odhlášení všech) a rozbil by
// dešifrování. Volá se lazy jen při šifrování/dešifrování (app nastartuje
// i bez ní; jen AI cesty s DB klíčem vrátí čitelnou chybu). Viz .env.example.
export const getEncKey = () =>
  required("SECRET_ENC_KEY", (v) => v.length >= 32, "min. 32 znaků, viz .env.example");

// Lomítka na konci se odstraňují — APP_URL s koncovým „/" jinak vyrobí
// dvojité lomítko v redirect_uri a Google přihlášení odmítne (stalo se při
// prvním nasazení na Railway 2026-07-13).
export const getAppUrl = () =>
  required(
    "APP_URL",
    (v) => v.startsWith("http"),
    "např. http://localhost:3000",
  ).replace(/\/+$/, "");

// E-maily adminů oddělené čárkou — při přihlášení dostanou isAdmin + canCreateProjects.
export const getAdminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const getGoogleClientId = () =>
  required("GOOGLE_CLIENT_ID", (v) => v.length > 10, "z Google Cloud Console");

export const getGoogleClientSecret = () =>
  required(
    "GOOGLE_CLIENT_SECRET",
    (v) => v.length > 10,
    "z Google Cloud Console",
  );
