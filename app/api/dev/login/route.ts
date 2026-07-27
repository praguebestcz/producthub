import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { signSessionToken, SESSION_TTL_SEC } from "@/lib/jwt";
import { getAppUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// DEV-ONLY rychlé přihlášení jako testovací uživatel - usnadňuje lokální
// testování (jinak by se session token musel ručně vkládat do cookie přes
// DevTools). Přihlásí JEN předdefinované testovací účty (googleId test-*),
// nikdy libovolného uživatele.
//
// ⚠️ Na produkci VŽDY 404 - žádná cesta obejít přihlášení nesmí existovat venku.
// Next.js nastavuje NODE_ENV=production v produkčním buildu.
export const dynamic = "force-dynamic";

const TEST_USERS: Record<string, string> = {
  b: "test-b-m6", // Testovací Klient B (externí, projekt 1)
  c: "test-c-m7", // Testovací Klient C
};

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const who = (req.nextUrl.searchParams.get("user") ?? "").toLowerCase();
  const googleId = TEST_USERS[who];
  if (!googleId) {
    return NextResponse.json(
      {
        error: "Zadej ?user=b nebo ?user=c",
        priklad: `${getAppUrl()}/api/dev/login?user=b`,
      },
      { status: 400 },
    );
  }
  const user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    return NextResponse.json(
      {
        error: `Testovací účet ${googleId} zatím neexistuje.`,
        napraveni: "Spusť v projektu: node _mkuser-b.mjs",
      },
      { status: 404 },
    );
  }

  const res = NextResponse.redirect(`${getAppUrl()}/`);
  res.cookies.set(SESSION_COOKIE, await signSessionToken(user.id), {
    httpOnly: true,
    secure: false, // jen lokální dev (localhost není https)
    sameSite: "lax",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  return res;
}
