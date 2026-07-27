import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { NotifyScopeSetting } from "./notify-scope-setting";
import { EmailNotifySetting } from "./email-notify-setting";

// Osobní nastavení uživatele: rozsah notifikací (M7) + e-mailová upozornění.
export default async function NastaveniPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <PageHeader
        title="Nastavení"
        description="Vaše osobní nastavení aplikace."
      />
      <section className="mt-8 grid max-w-xl gap-4">
        <Card>
          <CardContent>
            <NotifyScopeSetting initial={user.notifyScope} />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <EmailNotifySetting initial={user.emailNotify} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
