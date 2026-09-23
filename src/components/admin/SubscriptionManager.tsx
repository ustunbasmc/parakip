"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageSubscription } from "@/app/admin/subscriptions/actions";

/**
 * Bir kullanıcıya (Ev Premium) veya işletme alanına (İşletme Premium)
 * elle abonelik verme/uzatma/iptal. Her işlem onay ister ve işlem kaydına
 * yazılır.
 */
export function SubscriptionManager({
  plan,
  targetId,
  active,
  compact = false,
}: {
  plan: "home_premium" | "business";
  targetId: string;
  /** Şu an aktif bir abonelik var mı (iptal butonu için). */
  active: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [months, setMonths] = useState(1);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const planLabel = plan === "home_premium" ? "Ev Premium" : "İşletme Premium";

  function run(action: "extend" | "cancel") {
    const confirmText =
      action === "extend"
        ? `${planLabel} ${months} ay ${active ? "uzatılacak" : "verilecek"}. Onaylıyor musun?`
        : `${planLabel} aboneliği hemen iptal edilecek. Onaylıyor musun?`;
    if (!window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await manageSubscription({ plan, targetId, action, months, note });
      if (!res.ok) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({
        ok: true,
        text:
          action === "extend" && res.periodEnd
            ? `Kaydedildi. Yeni bitiş: ${new Date(res.periodEnd).toLocaleDateString("tr-TR")}`
            : "Abonelik iptal edildi.",
      });
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "rounded-xl border border-border bg-bg/40 p-3"}`}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Süre
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text-primary"
          >
            {[1, 3, 6, 12, 24].map((m) => (
              <option key={m} value={m}>
                {m} ay
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Not (isteğe bağlı)
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ör. kampanya, telafi"
            className="h-9 rounded-lg border border-border bg-surface px-2 text-sm normal-case tracking-normal text-text-primary"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("extend")}
          className="h-9 rounded-lg bg-accent px-3 text-sm font-bold text-text-on-accent disabled:opacity-60"
        >
          {active ? "Süreyi uzat" : `${planLabel} ver`}
        </button>
        {active ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("cancel")}
            className="h-9 rounded-lg border border-danger/40 px-3 text-sm font-bold text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            İptal et
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={`text-xs font-semibold ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
