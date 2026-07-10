import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, verifyIdToken } from "@/lib/google-oauth";
import { ensureUserFromGoogle, EmailConflictError, SESSION_COOKIE } from "@/lib/auth";
import { signSessionToken, SESSION_TTL_SEC } from "@/lib/jwt";
import { getAppUrl } from "@/lib/env";

// Krok 2 přihlášení: Google sem vrátí uživatele s ?code=...&state=...
// Ověříme state (CSRF), vyměníme code za id_token, ověříme identitu,
// založíme/aktualizujeme uživatele, převezmeme pozvánky a nastavíme session.
export async function GET(req: NextRequest) {
  const toLogin = (error: string) =>
    NextResponse.redirect(`${getAppUrl()}/login?error=${error}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get("oauth_state")?.value;

  // Google může vrátit i chybu (uživatel odmítl přístup).
  if (req.nextUrl.searchParams.get("error")) return toLogin("google-denied");
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return toLogin("state-mismatch");
  }

  try {
    const idToken = await exchangeCode(code);
    const profile = await verifyIdToken(idToken);
    const user = await ensureUserFromGoogle(profile);

    const res = NextResponse.redirect(`${getAppUrl()}/`);
    // Po expert review: httpOnly + secure v produkci + sameSite lax + path /.
    res.cookies.set(SESSION_COOKIE, await signSessionToken(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SEC,
      path: "/",
    });
    res.cookies.delete("oauth_state");
    return res;
  } catch (e) {
    if (e instanceof EmailConflictError) return toLogin("email-conflict");
    console.error("Google callback selhal:", e);
    // DOČASNÁ diagnostika (odstranit po vyřešení): zápis chyby do souboru,
    // protože výstup dev serveru není vždy po ruce.
    try {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(
        "_auth-debug.log",
        `${new Date().toISOString()} ${e instanceof Error ? e.stack ?? e.message : String(e)}\n\n`,
      );
    } catch {
      /* diagnostika nesmí shodit odpověď */
    }
    return toLogin("google-failed");
  }
}
