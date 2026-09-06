"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-5 font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";

// h-14 (56px): tek elle, başparmakla rahat dokunulabilir asgari hedef.
const sizing = "h-14 text-[1.0625rem]";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-text-on-accent active:bg-accent-hover",
  secondary: "bg-surface-muted text-text-primary active:bg-border",
  ghost: "bg-transparent text-accent active:bg-accent-soft",
};

export function Button({
  variant = "primary",
  loading = false,
  fullWidth = true,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${sizing} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${
        className ?? ""
      }`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}
