import { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-bg-card p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
