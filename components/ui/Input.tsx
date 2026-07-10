"use client";
import { InputHTMLAttributes, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // Nápověda pod polem (šedě). Nezobrazí se, když je vyplněná chyba (error má přednost).
  helperText?: string;
}

// Textové pole s popiskem, chybou a nápovědou. (Vzor vratky; bez varianty
// na hesla — ProductHub žádná hesla nemá, přihlašuje se přes Google.)
export function Input({
  label,
  error,
  helperText,
  className = "",
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const borderClasses = error
    ? "border-error focus:border-error focus:ring-error"
    : "border-line focus:border-ink focus:ring-ink";

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-ink-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-bg-card px-3 py-2 text-ink outline-none placeholder:text-ink-4 focus:ring-1 ${borderClasses} ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
      {!error && helperText && (
        <p className="mt-1 text-xs text-ink-3">{helperText}</p>
      )}
    </div>
  );
}
