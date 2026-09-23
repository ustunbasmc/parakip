"use client";

import { useState, useTransition } from "react";
import { sendTestEmail } from "@/app/admin/system/actions";

export function TestEmailButton() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await sendTestEmail()))}
        className="h-9 w-fit rounded-lg bg-accent px-3 text-sm font-bold text-text-on-accent disabled:opacity-60"
      >
        {pending ? "Gönderiliyor..." : "Kendime test e-postası gönder"}
      </button>
      {result ? (
        <p role="status" className={`text-xs font-semibold ${result.ok ? "text-success" : "text-danger"}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
