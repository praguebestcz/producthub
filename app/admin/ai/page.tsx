import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  apiKeyStatus,
  getAppConfig,
  monthlyUsageSummary,
} from "@/lib/ai/config";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { AiConfigForm } from "@/components/admin/ai-config-form";

// AI nastavení — JEN pro admina. Anthropic klíč, měsíční limit, přehled spotřeby.
export default async function AiSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/");

  const [apiKey, cfg, usage] = await Promise.all([
    apiKeyStatus(),
    getAppConfig(),
    monthlyUsageSummary(),
  ]);

  return (
    <AppShell user={user}>
      <PageHeader
        title="AI nastavení"
        description="Anthropic API klíč, měsíční limit a přehled spotřeby pro generování promptů (M8)."
      />
      <AiConfigForm
        initial={{
          apiKey,
          monthlyGenerationLimit: cfg.monthlyGenerationLimit,
          usage,
        }}
      />
    </AppShell>
  );
}
