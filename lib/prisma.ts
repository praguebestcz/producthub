import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — celá aplikace (i po hot-reloadu při vývoji) sdílí
// jediné DB spojení. Bez singletonu by Next.js dev server otevíral nové spojení
// při každé změně souboru, až do vyčerpání limitu PostgreSQL. (Vzor vratky.)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
