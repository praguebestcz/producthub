"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Interaktivní ukázky pro styleguide — dialog, potvrzení mazání a toasty.
export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        Otevřít dialog
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ukázkový dialog</DialogTitle>
          <DialogDescription>
            Zavře se křížkem, klávesou Esc nebo klikem mimo okno.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button onClick={() => setOpen(false)}>Potvrdit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AlertDialogDemo() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Smazat (s potvrzením)
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Opravdu smazat?</AlertDialogTitle>
          <AlertDialogDescription>
            Destruktivní akce vždy používají AlertDialog — vyžadují výslovné
            potvrzení a nejdou zavřít omylem klikem mimo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => toast.success("Smazáno (jen ukázka).")}
          >
            Smazat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toast.success("Uloženo. Vše proběhlo v pořádku.")}
      >
        Toast: úspěch
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info("Toto je informační oznámení.")}
      >
        Toast: info
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Něco se pokazilo. Zkuste to znovu.")}
      >
        Toast: chyba
      </Button>
    </div>
  );
}
