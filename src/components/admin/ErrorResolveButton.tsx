"use client";

import { useTransition } from "react";
import { setErrorResolved } from "@/app/admin/errors/actions";

export function ErrorResolveButton({ id, resolved }: { id: string; resolved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setErrorResolved(id, !resolved)))}
      className={`h-8 rounded-lg px-3 text-xs font-bold disabled:opacity-60 ${resolved ? "border border-border text-text-secondary" : "bg-accent text-text-on-accent"}`}
    >
      {pending ? "..." : resolved ? "Yeniden aç" : "Çözüldü"}
    </button>
  );
}
