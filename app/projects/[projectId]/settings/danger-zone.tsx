"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Smazání projektu — nevratné (kaskáda smaže dokumenty, komentáře, požadavky).
// Dvojitá pojistka: AlertDialog + opsání názvu projektu.
export function DangerZone({
  projectId,
  projectName,
}: {
  projectId: number;
  projectName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteProject() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Projekt „${projectName}" byl smazán.`);
      router.push("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smazání se nepovedlo.");
      setDeleting(false);
    }
  }

  return (
    <Card className="mt-4 border-destructive/40">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Smazat projekt</p>
          <p className="text-sm text-muted-foreground">
            Nevratně odstraní projekt včetně dokumentů, komentářů a požadavků.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <Trash2 />
            Smazat projekt
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Opravdu smazat „{projectName}&ldquo;?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tohle nejde vrátit zpět. Smažou se všechny dokumenty, verze,
                komentáře i požadavky. Pro potvrzení opište název projektu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={projectName}
              aria-label="Opište název projektu"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText("")}>
                Zrušit
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={confirmText !== projectName || deleting}
                onClick={deleteProject}
              >
                {deleting ? "Mažu…" : "Rozumím, smazat"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
