import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Vrátí přihlášeného uživatele (bez citlivých polí) — pro klientské komponenty.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    canCreateProjects: user.canCreateProjects,
  });
}
