"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";

// Interaktivní ukázky pro styleguide — modal a toast potřebují klientský stav.
export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Otevřít modal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Ukázkový modal">
        <p className="text-sm leading-relaxed text-ink-2">
          Zavře se křížkem, klávesou Esc nebo klikem mimo okno. Na mobilu
          najíždí zespodu, na desktopu je vycentrovaný.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button onClick={() => setOpen(false)}>Potvrdit</Button>
        </div>
      </Modal>
    </>
  );
}

export function ToastDemo() {
  const [tone, setTone] = useState<"success" | "info" | "danger" | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setTone("success")}>
          Toast: úspěch
        </Button>
        <Button variant="secondary" onClick={() => setTone("info")}>
          Toast: info
        </Button>
        <Button variant="secondary" onClick={() => setTone("danger")}>
          Toast: chyba
        </Button>
      </div>
      <Toast
        open={tone !== null}
        tone={tone ?? "info"}
        message={
          tone === "success"
            ? "Uloženo. Vše proběhlo v pořádku."
            : tone === "danger"
              ? "Něco se pokazilo. Zkuste to znovu."
              : "Toto je informační oznámení."
        }
        onClose={() => setTone(null)}
      />
    </>
  );
}
