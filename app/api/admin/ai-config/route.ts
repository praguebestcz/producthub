import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { aiConfigPatchSchema } from "@/lib/validation";
import { BodyTooLargeError, readJsonLimited } from "@/lib/http";
import {
  apiKeyStatus,
  getAppConfig,
  monthlyUsageSummary,
  setAnthropicApiKey,
  setMonthlyBudgetCents,
} from "@/lib/ai/config";

// AI nastavení (app-wide) — JEN pro admina. GET vrací maskovaný stav + přehled
// spotřeby; PATCH nastaví klíč / limit. Dešifrovaný klíč se NIKDY nevrací.

const MAX_BODY_BYTES = 2_048;

async function payload() {
  const [key, cfg, usage] = await Promise.all([
    apiKeyStatus(),
    getAppConfig(),
    monthlyUsageSummary(),
  ]);
  return {
    apiKey: key, // { source, last4 } — NIKDY plný klíč
    monthlyBudgetUsd: cfg.monthlyBudgetUsdCents / 100,
    usage,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Přístup zamítnut" }, { status: 403 });
  }
  return NextResponse.json(await payload());
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Přístup zamítnut" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await readJsonLimited(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return NextResponse.json({ error: "Neplatný vstup" }, { status: 413 });
    }
    throw e;
  }

  const parsed = aiConfigPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný vstup" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Klíč: string = nastavit (zašifruje), null = smazat. Šifrování potřebuje
  // SECRET_ENC_KEY — když chybí, getEncKey vyhodí chybu → čitelná hláška 503.
  if (input.anthropicApiKey !== undefined) {
    try {
      await setAnthropicApiKey(input.anthropicApiKey);
    } catch {
      return NextResponse.json(
        {
          error:
            "Klíč nejde uložit — chybí SECRET_ENC_KEY (šifrování). Nastavte ji podle .env.example.",
        },
        { status: 503 },
      );
    }
  }
  if (input.monthlyBudgetUsd !== undefined) {
    await setMonthlyBudgetCents(Math.round(input.monthlyBudgetUsd * 100));
  }

  return NextResponse.json(await payload());
}
