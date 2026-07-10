import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";

// Odhlášení: smaže session cookie a pošle uživatele na /login.
// POST (ne GET) — odhlášení mění stav, nesmí ho spustit prefetch odkazu.
export async function POST() {
  const res = NextResponse.redirect(`${getAppUrl()}/login`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
