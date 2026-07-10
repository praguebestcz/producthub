"use client";
import { TextareaHTMLAttributes, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = "",
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const autoId = useId();
  const taId = id ?? autoId;

  const borderClasses = error
    ? "border-error focus:border-error focus:ring-error"
    : "border-line focus:border-ink focus:ring-ink";

  return (
    <div>
      {label && (
        <label
          htmlFor={taId}
          className="mb-1 block text-sm font-medium text-ink-2"
        >
          {label}
        </label>
      )}
      <textarea
        id={taId}
        rows={rows}
        className={`w-full rounded-lg border bg-bg-card px-3 py-2 text-ink outline-none placeholder:text-ink-4 focus:ring-1 ${borderClasses} ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  );
}
