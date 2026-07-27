"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { userColor } from "@/lib/presence/colors";
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

// Akce u vlastního komentáře (kebab menu ⋮) — vzor Google komentářů. Upravit
// otevře inline editor, Smazat vyvolá potvrzovací dialog. Ukázka je statická.
export function CommentActionsDemo() {
  const color = userColor(3);
  return (
    <div className="w-72 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span
          className="flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}` }}
        >
          H
        </span>
        <span className="truncate text-sm font-medium">Hana</span>
        <span className="ml-auto text-[11px] text-muted-foreground">teď</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Možnosti komentáře"
                className="-my-1 size-7 text-muted-foreground"
              />
            }
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem>
              <Pencil aria-hidden="true" />
              Upravit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 aria-hidden="true" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-1 text-sm">
        Ukázkový komentář s akcemi u vlastního příspěvku.
      </p>
    </div>
  );
}

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
