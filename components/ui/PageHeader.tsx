import { ReactNode } from "react";

// Hlavička stránky (drobečky + velký nadpis + akce vpravo). Inline v obsahu —
// globální hlavička aplikace je nad obsahem. Stejný vzhled napříč aplikací.
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  return (
    <div className="border-b border-line pb-6">
      {breadcrumbs && <div className="mb-2">{breadcrumbs}</div>}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-bold leading-[1.15] tracking-tight text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 text-sm text-ink-3">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
