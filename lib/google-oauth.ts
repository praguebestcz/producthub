import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAppUrl, getGoogleClientId, getGoogleClientSecret } from "./env";

// Google OAuth (authorization code flow) bez knihovny třetí strany.
// Tok: /api/auth/google → přesměrování na Google → uživatel povolí →
// Google volá /api/auth/google/callback?code=...&state=... → výměna kódu
// za id_token → ověření podpisu proti Google JWKS → profil uživatele.
//
// Po expert review je ověření id_tokenu závazné v tomto rozsahu:
//   - podpis proti https://www.googleapis.com/oauth2/v3/certs (JWKS)
//   - aud === GOOGLE_CLIENT_ID
//   - iss ∈ {accounts.google.com, https://accounts.google.com}
//   - email_verified === true (jinak jde převzít pozvánku přes neověřený e-mail)

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

// JWKS se cachuje na úrovni modulu — jose si klíče stahuje a obnovuje sám.
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export function redirectUri(): string {
  return `${getAppUrl()}/api/auth/google/callback`;
}

// Sestaví URL, kam se uživatel přesměruje na Google přihlášení.
// `state` = náhodná hodnota proti CSRF, uložená zároveň v krátkodobé cookie.
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    // Vždy nabídnout výběr účtu — uživatelé PB mívají víc Google účtů.
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

// Vymění authorization code za tokeny. Zajímá nás jen id_token (identita);
// access/refresh tokeny neukládáme — Google API dál nevoláme.
export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token endpoint vrátil ${res.status}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("Google nevrátil id_token");
  }
  return data.id_token;
}

export type GoogleProfile = {
  googleId: string;
  email: string; // lowercase
  name: string;
  avatarUrl: string | null;
};

// Čistá validace claimů — oddělená kvůli testovatelnosti (bez sítě).
export function validateGoogleClaims(claims: {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}): GoogleProfile {
  if (typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("id_token neobsahuje sub");
  }
  if (typeof claims.email !== "string" || !claims.email.includes("@")) {
    throw new Error("id_token neobsahuje e-mail");
  }
  // Po expert review: bez ověřeného e-mailu nelze párovat pozvánky.
  if (claims.email_verified !== true) {
    throw new Error("Google e-mail není ověřený (email_verified)");
  }
  return {
    googleId: claims.sub,
    email: claims.email.toLowerCase(),
    name:
      typeof claims.name === "string" && claims.name
        ? claims.name
        : claims.email.toLowerCase(),
    avatarUrl: typeof claims.picture === "string" ? claims.picture : null,
  };
}

// Ověří podpis id_tokenu proti Google JWKS + aud + iss, pak claimy.
export async function verifyIdToken(idToken: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    audience: getGoogleClientId(),
    issuer: GOOGLE_ISSUERS,
  });
  return validateGoogleClaims(payload);
}
