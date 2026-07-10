import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Table, Tr, Td } from "@/components/ui/Table";
import { Logo } from "@/components/ui/Logo";
import { ModalDemo, ToastDemo } from "./demos";

// Živý styleguide — přehled tokenů a komponent na jednom místě.
// Referenční stránka pro všechny další obrazovky (viz docs/styling.md).

const COLORS: { name: string; varName: string }[] = [
  { name: "pb", varName: "--color-pb" },
  { name: "pb-bright", varName: "--color-pb-bright" },
  { name: "pb-orange", varName: "--color-pb-orange" },
  { name: "ink", varName: "--color-ink" },
  { name: "ink-2", varName: "--color-ink-2" },
  { name: "ink-3", varName: "--color-ink-3" },
  { name: "ink-4", varName: "--color-ink-4" },
  { name: "line", varName: "--color-line" },
  { name: "bg", varName: "--color-bg" },
  { name: "bg-card", varName: "--color-bg-card" },
  { name: "success", varName: "--color-success" },
  { name: "error", varName: "--color-error" },
  { name: "warning", varName: "--color-warning" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default async function StyleguidePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PageHeader
          title="Styleguide"
          description="Design tokeny a komponenty ProductHubu. Každá nová obrazovka se skládá z těchto dílů — viz docs/styling.md."
        />

        <Section title="Logo">
          <div className="flex flex-wrap items-center gap-8">
            <Logo />
            <Logo size="lg" />
          </div>
        </Section>

        <Section title="Barvy (tokeny)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {COLORS.map((c) => (
              <div
                key={c.name}
                className="rounded-xl border border-line bg-bg-card p-3"
              >
                <span
                  className="block h-10 w-full rounded-lg border border-line-soft"
                  style={{ background: `var(${c.varName})` }}
                />
                <span className="mt-2 block text-xs font-medium text-ink-2">
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typografie">
          <Card className="space-y-3">
            <p className="text-[28px] font-bold leading-[1.15] tracking-tight">
              Nadpis stránky (28px bold)
            </p>
            <p className="text-lg font-semibold tracking-tight">
              Nadpis sekce (18px semibold)
            </p>
            <p className="text-sm text-ink-2">
              Běžný text v aplikaci (14px, ink-2). Delší odstavce mají
              volnější řádkování, aby se dobře četly.
            </p>
            <p className="text-xs text-ink-4">
              Popisek / nápověda (12px, ink-4)
            </p>
            <p className="font-mono text-sm">Monospace — kódy, cesty souborů</p>
          </Card>
        </Section>

        <Section title="Tlačítka">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Hlavní akce</Button>
            <Button variant="secondary">Vedlejší akce</Button>
            <Button variant="danger">Smazat</Button>
            <Button loading>Načítám</Button>
            <Button disabled>Nedostupné</Button>
            <IconButton aria-label="Upravit">
              <Pencil size={15} />
            </IconButton>
          </div>
        </Section>

        <Section title="Formulářové prvky">
          <Card className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Input
              label="Název projektu"
              placeholder="Např. Diskuse k produktům"
              helperText="Zobrazí se recenzentům v hlavičce."
            />
            <Input
              label="E-mail s chybou"
              defaultValue="neni-email"
              error="Zadejte platný e-mail."
            />
            <Select label="Role">
              <option>Autor</option>
              <option>Komentátor</option>
              <option>Čtenář</option>
            </Select>
            <div className="flex items-end pb-2">
              <Checkbox label="Interní člen (vidí interní komentáře)" />
            </div>
            <div className="sm:col-span-2">
              <Textarea
                label="Komentář"
                placeholder="Napište připomínku k vybranému elementu…"
              />
            </div>
          </Card>
        </Section>

        <Section title="Štítky (Badge)">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Čtenář</Badge>
            <Badge tone="pb">Autor</Badge>
            <Badge tone="success">Vyřešeno</Badge>
            <Badge tone="warning">Čeká na schválení</Badge>
            <Badge tone="danger">Osiřelý komentář</Badge>
          </div>
        </Section>

        <Section title="Hlášky (Alert)">
          <div className="max-w-2xl space-y-3">
            <Alert tone="info">Požadavek byl schválen a prompt vygenerován.</Alert>
            <Alert tone="danger">
              Import se nepovedl — stránka je větší než 5 MB.
            </Alert>
          </div>
        </Section>

        <Section title="Tabulka">
          <Table head={["Dokument", "Verze", "Stav", "Komentáře"]}>
            <Tr>
              <Td className="font-medium text-ink">Klikací prototyp</Td>
              <Td>v3</Td>
              <Td>
                <Badge tone="success">Aktuální</Badge>
              </Td>
              <Td>12 otevřených</Td>
            </Tr>
            <Tr>
              <Td className="font-medium text-ink">Wireframy</Td>
              <Td>v1</Td>
              <Td>
                <Badge tone="neutral">Beze změn</Badge>
              </Td>
              <Td>3 vyřešené</Td>
            </Tr>
          </Table>
        </Section>

        <Section title="Modal a Toast">
          <div className="flex flex-wrap items-center gap-6">
            <ModalDemo />
            <ToastDemo />
          </div>
        </Section>
      </main>
    </>
  );
}
