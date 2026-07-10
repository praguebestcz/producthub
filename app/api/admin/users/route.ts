import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Seznam uživatelů — jen pro adminy (proxy hlídá session, isAdmin hlídáme tady).
export async function GET() {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      canCreateProjects: true,
      isAdmin: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}
