"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeOwnSupportTicket } from "@/app/support/actions";

/** Sorunu çözülen kullanıcının talebini kendisi kapatması için. */
export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!window.confirm("Talebi kapatmak istediğine emin misin? Kapatılan talebe yeni mesaj yazılamaz.")) return;
    setError(null);
    startTransition(async () => {
      const res = await closeOwnSupportTicket(ticketId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClose}
        disabled={pending}
        className="rounded-full px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? "Kapatılıyor..." : "Sorunum çözüldü, talebi kapat"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
