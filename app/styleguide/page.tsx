import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { DialogDemo, AlertDialogDemo, ToastDemo } from "./demos";

// Živý styleguide — přehled tokenů a shadcn komponent na jednom místě.
// Referenční stránka pro všechny další obrazovky (viz docs/styling.md).

const COLORS: { name: string; varName: string }[] = [
  { name: "primary (PB)", varName: "--primary" },
  { name: "pb-orange", varName: "--color-pb-orange" },
  { name: "background", varName: "--background" },
  { name: "card", varName: "--card" },
  { name: "muted", varName: "--muted" },
  { name: "border", varName: "--border" },
  { name: "foreground", varName: "--foreground" },
  { name: "muted-foreground", varName: "--muted-foreground" },
  { name: "destructive", varName: "--destructive" },
  { name: "success", varName: "--color-success" },
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
    <AppShell user={user}>
      <PageHeader
        title="Styleguide"
        description="Design tokeny a shadcn/ui komponenty ProductHubu. Každá nová obrazovka se skládá z těchto dílů — viz docs/styling.md."
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
            <div key={c.name} className="rounded-xl border bg-card p-3">
              <span
                className="block h-10 w-full rounded-lg border"
                style={{ background: `var(${c.varName})` }}
              />
              <span className="mt-2 block text-xs font-medium text-muted-foreground">
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typografie">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-[28px] font-bold leading-[1.15] tracking-tight">
              Nadpis stránky (28px bold)
            </p>
            <p className="text-lg font-semibold tracking-tight">
              Nadpis sekce (18px semibold)
            </p>
            <p className="text-sm text-muted-foreground">
              Běžný text v aplikaci (14px, muted-foreground). Delší odstavce
              mají volnější řádkování, aby se dobře četly.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Popisek / nápověda (12px)
            </p>
            <p className="font-mono text-sm">Monospace — kódy, cesty souborů</p>
          </CardContent>
        </Card>
      </Section>

      <Section title="Tlačítka">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Hlavní akce</Button>
          <Button variant="outline">Vedlejší akce</Button>
          <Button variant="secondary">Sekundární</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Smazat</Button>
          <Button disabled>Nedostupné</Button>
          <Button variant="outline" size="icon" aria-label="Upravit">
            <Pencil />
          </Button>
        </div>
      </Section>

      <Section title="Formulářové prvky">
        <Card>
          <CardContent className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="sg-name">Název projektu</Label>
              <Input id="sg-name" placeholder="Např. Diskuse k produktům" />
              <p className="text-xs text-muted-foreground">
                Zobrazí se recenzentům v hlavičce.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sg-email">E-mail s chybou</Label>
              <Input
                id="sg-email"
                defaultValue="neni-email"
                aria-invalid="true"
              />
              <p className="text-xs text-destructive">Zadejte platný e-mail.</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              {/* items = mapa hodnota → popisek; bez ní by trigger ukazoval
                  syrovou hodnotu („commenter") místo popisku */}
              <Select
                defaultValue="commenter"
                items={[
                  { value: "author", label: "Autor" },
                  { value: "commenter", label: "Komentátor" },
                  { value: "reader", label: "Čtenář" },
                ]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="author">Autor</SelectItem>
                  <SelectItem value="commenter">Komentátor</SelectItem>
                  <SelectItem value="reader">Čtenář</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-6 pb-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked /> Interní člen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch defaultChecked /> Aktivní
              </label>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="sg-comment">Komentář</Label>
              <Textarea
                id="sg-comment"
                placeholder="Napište připomínku k vybranému elementu…"
              />
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Štítky (Badge)">
        <div className="flex flex-wrap gap-2">
          <Badge>Autor</Badge>
          <Badge variant="secondary">Čtenář</Badge>
          <Badge variant="outline">Verze v3</Badge>
          <Badge variant="destructive">Osiřelý komentář</Badge>
          <Badge className="bg-success/15 text-success">Vyřešeno</Badge>
          <Badge className="bg-warning/15 text-warning">
            Čeká na schválení
          </Badge>
        </div>
      </Section>

      <Section title="Hlášky (Alert)">
        <div className="max-w-2xl space-y-3">
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Hotovo</AlertTitle>
            <AlertDescription>
              Požadavek byl schválen a prompt vygenerován.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Import se nepovedl</AlertTitle>
            <AlertDescription>Stránka je větší než 5 MB.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Tabulka">
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dokument</TableHead>
                <TableHead>Verze</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead>Komentáře</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Klikací prototyp</TableCell>
                <TableCell>v3</TableCell>
                <TableCell>
                  <Badge className="bg-success/15 text-success">Aktuální</Badge>
                </TableCell>
                <TableCell>12 otevřených</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Wireframy</TableCell>
                <TableCell>v1</TableCell>
                <TableCell>
                  <Badge variant="secondary">Beze změn</Badge>
                </TableCell>
                <TableCell>3 vyřešené</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Načítání (Skeleton)">
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-5 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </Section>

      <Separator className="mt-10" />

      <Section title="Dialog, potvrzení a toasty">
        <div className="flex flex-wrap items-center gap-3">
          <DialogDemo />
          <AlertDialogDemo />
          <ToastDemo />
        </div>
      </Section>
    </AppShell>
  );
}
