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

export const getAppUrl = () =>
  required("APP_URL", (v) => v.startsWith("http"), "např. http://localhost:3000");

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
