import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";
import { CHANGE_MODEL } from "@/lib/ai/change-prompt";

// AI konfigurace (app-wide, jediný řádek AppConfig id=1) + spotřeba (AiUsage).
// Klíč se dešifruje JEN tady (server-side) a NIKDY se nevrací klientovi.

// Klíč z DB (dešifrovaný) má přednost před env. Nastavuje se v adminu.
export class KeyDecryptError extends Error {
  constructor() {
    super("Uložený AI klíč nejde dešifrovat (změnila se SECRET_ENC_KEY?).");
    this.name = "KeyDecryptError";
  }
}

// Jediný řádek konfigurace (seed je v migraci; upsert je pojistka).
export async function getAppConfig() {
  return prisma.appConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// Anthropic klíč pro volání Claude: z DB (dešifrovaný) má přednost, jinak env.
// null = žádný klíč. Vyhazuje KeyDecryptError, když DB klíč nejde dešifrovat.
export async function resolveAnthropicApiKey(): Promise<string | null> {
  const cfg = await prisma.appConfig.findUnique({
    where: { id: 1 },
    select: { anthropicApiKeyEnc: true },
  });
  if (cfg?.anthropicApiKeyEnc) {
    try {
      return decryptSecret(cfg.anthropicApiKeyEnc);
    } catch {
      throw new KeyDecryptError();
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? null;
}

// Zdroj klíče a maskovaná podoba pro admin UI — NIKDY nevrací plný klíč.
export async function apiKeyStatus(): Promise<{
  source: "db" | "env" | "none";
  last4: string | null;
}> {
  const cfg = await prisma.appConfig.findUnique({
    where: { id: 1 },
    select: { anthropicApiKeyLast4: true, anthropicApiKeyEnc: true },
  });
  if (cfg?.anthropicApiKeyEnc) {
    return { source: "db", last4: cfg.anthropicApiKeyLast4 ?? null };
  }
  const env = process.env.ANTHROPIC_API_KEY;
  if (env) return { source: "env", last4: env.slice(-4) };
  return { source: "none", last4: null };
}

// Nastavit (zašifrovat) nebo smazat (null) klíč v DB. Ukládá ciphertext + last4.
export async function setAnthropicApiKey(plainOrNull: string | null) {
  if (plainOrNull === null) {
    await prisma.appConfig.upsert({
      where: { id: 1 },
      update: { anthropicApiKeyEnc: null, anthropicApiKeyLast4: null },
      create: { id: 1 },
    });
    return;
  }
  const enc = encryptSecret(plainOrNull);
  const last4 = plainOrNull.slice(-4);
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: { anthropicApiKeyEnc: enc, anthropicApiKeyLast4: last4 },
    create: { id: 1, anthropicApiKeyEnc: enc, anthropicApiKeyLast4: last4 },
  });
}

// Rozpočet v centech USD (0 = bez limitu).
export async function setMonthlyBudgetCents(cents: number) {
  await prisma.appConfig.upsert({
    where: { id: 1 },
    update: { monthlyBudgetUsdCents: cents },
    create: { id: 1, monthlyBudgetUsdCents: cents },
  });
}

// Začátek aktuálního kalendářního měsíce (lokální čas serveru).
function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Čistá logika rozpočtu (testovatelná): 0 = bez limitu, jinak blokuj, když už
// utracená částka za měsíc dosáhla rozpočtu (obě v USD).
export function isOverBudget(spentUsd: number, budgetUsd: number): boolean {
  return budgetUsd > 0 && spentUsd >= budgetUsd;
}

// Zapíše spotřebu po ÚSPĚŠNÉM generování (neúspěch se nepočítá do limitu).
export async function logAiUsage(data: {
  projectId: number | null;
  userId: number | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  await prisma.aiUsage.create({ data });
}

// === Odhad ceny ===
// Ceník za 1M tokenů (USD). TODO(Dev): ověřit aktuální ceník claude-sonnet-5.
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
};
// Přibližný kurz pro převod na Kč (odhad). TODO(Dev): případně načítat kurz.
const CZK_PER_USD = 23;

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICE_PER_MTOK_USD[model] ?? PRICE_PER_MTOK_USD["claude-sonnet-5"];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// Přehled spotřeby za aktuální měsíc (počet + tokeny + odhad ceny).
export async function monthlyUsageSummary(): Promise<{
  count: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costCzk: number;
}> {
  const agg = await prisma.aiUsage.aggregate({
    where: { createdAt: { gte: startOfMonth() } },
    _count: { _all: true },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const inputTokens = agg._sum.inputTokens ?? 0;
  const outputTokens = agg._sum.outputTokens ?? 0;
  // Odhad přes cenu sonnet-5 (jediný používaný model).
  const costUsd = estimateCostUsd(CHANGE_MODEL, inputTokens, outputTokens);
  return {
    count: agg._count._all,
    inputTokens,
    outputTokens,
    costUsd,
    costCzk: costUsd * CZK_PER_USD,
  };
}
