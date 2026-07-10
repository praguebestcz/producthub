import { ReactNode } from "react";
import { AlertCircle, CheckCircle2, LucideIcon } from "lucide-react";

type Tone = "danger" | "info";

// Každý tón má svou barvu i ikonu — význam tak nestojí jen na barvě (přístupnost / WCAG:
// nespoléhat se pouze na barvu). `info` = pozitivní potvrzení (uloženo, odesláno…).
const tones: Record<Tone, { box: string; Icon: LucideIcon }> = {
  danger: {
    box: "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300",
    Icon: AlertCircle,
  },
  info: {
    box: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
    Icon: CheckCircle2,
  },
};

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const { box, Icon } = tones[tone];
  return (
    // role="alert" → čtečka obrazovky hlášku rovnou oznámí (nezmizí bez povšimnutí).
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${box}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
