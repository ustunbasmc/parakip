"use client";

import type { SelectHTMLAttributes } from "react";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}

export function FormSelect({ label, options, placeholder, error, id, className, ...rest }: FormSelectProps) {
  const selectId = id ?? label;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`h-14 rounded-2xl border bg-surface px-4 text-[1.0625rem] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent ${
          error ? "border-danger" : "border-border"
        } ${className ?? ""}`}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
