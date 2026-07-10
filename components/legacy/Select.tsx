"use client";
import { SelectHTMLAttributes, ReactNode, useId } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({
  label,
  className = "",
  id,
  children,
  ...rest
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-sm font-medium text-ink-2"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border border-line bg-bg-card px-3 py-2 text-ink outline-none focus:border-ink focus:ring-1 focus:ring-ink ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
