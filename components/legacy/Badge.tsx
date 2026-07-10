import { ReactNode } from "react";

type Tone = "neutral" | "pb" | "success" | "warning" | "danger";

// Stavový štítek (chip). Jemný obrys (ring) + barevné pozadí — čitelný a „jako štítek"
// ve světlém i tmavém režimu. (Vzor vratky.)
const tones: Record<Tone, string> = {
  neutral:
    "bg-[#f0f0f0] text-[#525252] ring-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.10)] dark:text-[#c4c4c4] dark:ring-[rgba(255,255,255,0.14)]",
  pb: "bg-[#fdecef] text-[#c41f3d] ring-[rgba(218,42,73,0.22)] dark:bg-[rgba(255,48,87,0.22)] dark:text-[#ff9fae] dark:ring-[rgba(255,48,87,0.38)]",
  success:
    "bg-[#e7f6ee] text-[#15783f] ring-[rgba(22,163,74,0.22)] dark:bg-[rgba(34,197,94,0.20)] dark:text-[#7ee8a6] dark:ring-[rgba(34,197,94,0.34)]",
  warning:
    "bg-[#fff4e0] text-[#9a6207] ring-[rgba(217,119,6,0.22)] dark:bg-[rgba(245,158,11,0.22)] dark:text-[#fbd576] dark:ring-[rgba(245,158,11,0.38)]",
  danger:
    "bg-[#fdecef] text-[#c41f3d] ring-[rgba(218,42,73,0.22)] dark:bg-[rgba(255,48,87,0.22)] dark:text-[#ff9fae] dark:ring-[rgba(255,48,87,0.38)]",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
