import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google-oauth";

// Krok 1 přihlášení: vygeneruje náhodný `state` (ochrana proti CSRF),
// uloží ho do krátkodobé cookie a přesměruje uživatele na Google.
export async function GET() {
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60, // 10 minut na dokončení přihlášení
    path: "/",
  });
  return res;
}
