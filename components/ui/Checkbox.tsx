"use client";
import { InputHTMLAttributes, useId } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Checkbox({ label, className = "", id, ...rest }: CheckboxProps) {
  const autoId = useId();
  const cbId = id ?? autoId;
  return (
    <label
      htmlFor={cbId}
      className="inline-flex cursor-pointer select-none items-center gap-2"
    >
      <input
        id={cbId}
        type="checkbox"
        className={`h-4 w-4 rounded border-line accent-pb ${className}`}
        {...rest}
      />
      {label && <span className="text-sm text-ink-2">{label}</span>}
    </label>
  );
}
