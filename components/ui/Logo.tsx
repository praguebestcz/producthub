import { MessagesSquare } from "lucide-react";

// Logo „PB ProductHub" — dlaždice s gradientem (PB červená → oranžová)
// a ikonou diskuse + nápis (PB tučně). Volitelně větší varianta (login).
export function Logo({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "md" | "lg";
}) {
  const tile =
    size === "lg" ? "h-11 w-11 rounded-xl" : "h-7 w-7 rounded-lg";
  const icon = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  const text = size === "lg" ? "text-xl" : "text-[15px]";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`inline-flex flex-shrink-0 items-center justify-center bg-gradient-to-br from-pb to-pb-orange text-white shadow-sm shadow-pb/30 ${tile}`}
      >
        <MessagesSquare className={icon} strokeWidth={2.4} />
      </span>
      <span className={`tracking-tight text-ink ${text}`}>
        <span className="font-extrabold">PB</span>{" "}
        <span className="font-semibold">ProductHub</span>
      </span>
    </span>
  );
}
