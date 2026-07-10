import { ReactNode } from "react";

// Znovupoužitelná tabulka. `head` = názvy sloupců, řádky se skládají z <Tr> + <Td>.
// Sudé řádky mají jemné podbarvení (zebra); klikatelný řádek (<Tr onClick>) se po najetí
// zvýrazní červeně (proužek vlevo). (Vzor vratky.)
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-ink-4">
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Řádek tabulky. S `onClick` je klikatelný (kurzor + červené zvýraznění po najetí).
export function Tr({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-line-soft last:border-0 even:bg-bg-subtle transition-colors ${
        onClick
          ? "cursor-pointer hover:bg-pb-soft hover:shadow-[inset_3px_0_0_var(--color-pb)]"
          : ""
      }`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 text-ink-2 ${className}`}>{children}</td>;
}
