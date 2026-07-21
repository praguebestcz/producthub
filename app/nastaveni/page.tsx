import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { NotifyScopeSetting } from "./notify-scope-setting";

// Osobní nastavení uživatele. Zatím jen rozsah notifikací (M7).
export default async function NastaveniPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <PageHeader
        title="Nastavení"
        description="Vaše osobní nastavení aplikace."
      />
      <section className="mt-8 max-w-xl">
        <Card>
          <CardContent>
            <NotifyScopeSetting initial={user.notifyScope} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
