"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserBan } from "@/app/admin/users/[id]/actions";

export function UserBanControl({ userId, banned, disabledReason }: { userId: string; banned: boolean; disabledReason?: string | null }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const text = banned
      ? "Hesabın askısı kaldırılacak ve kullanıcı yeniden giriş yapabilecek. Onaylıyor musun?"
      : "Hesap askıya alınacak: kullanıcı giriş yapamaz (verileri silinmez). Onaylıyor musun?";
    if (!window.confirm(text)) return;
    setError(null);
    startTransition(async () => {
      const res = await setUserBan(userId, !banned, reason);
      if (!res.ok) setError(res.error);
      else {
        setReason("");
        router.refresh();
      }
    });
  }

  if (disabledReason) return <p className="text-xs text-text-muted">{disabledReason}</p>;

  return (
    <div className="flex flex-col gap-2">
      <input
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
        placeholder={banned ? "Askıyı kaldırma notu (isteğe bağlı)" : "Askıya alma nedeni (işlem kaydına yazılır)"}
        className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary"
      />
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={`h-9 w-fit rounded-lg px-3 text-sm font-bold disabled:opacity-60 ${
          banned ? "bg-accent text-text-on-accent" : "border border-danger/40 text-danger hover:bg-danger-soft"
        }`}
      >
        {pending ? "İşleniyor..." : banned ? "Askıyı kaldır" : "Hesabı askıya al"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
