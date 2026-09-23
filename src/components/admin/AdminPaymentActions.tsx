"use client";

import { useState } from "react";
import { approvePaymentRequest, rejectPaymentRequest } from "@/app/admin/payments/actions";

export function AdminPaymentActions({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  async function handleApprove() {
    if (!window.confirm("Banka hareketinde bu referans kodunu gördün mü? Onay, aboneliği hemen aktifleştirir.")) return;
    setLoading("approve");
    setError(null);
    try {
      await approvePaymentRequest(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onaylanamadı.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setLoading("reject");
    setError(null);
    try {
      await rejectPaymentRequest(requestId, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reddedilemedi.");
    } finally {
      setLoading(null);
      setRejecting(false);
    }
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2">
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Red sebebi (opsiyonel)"
          className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-text-primary"
        />
        <div className="flex gap-2">
          <button onClick={handleReject} disabled={loading === "reject"} className="h-9 rounded-lg bg-danger px-3 text-sm font-bold text-white disabled:opacity-60">
            {loading === "reject" ? "..." : "Reddet"}
          </button>
          <button onClick={() => setRejecting(false)} className="h-9 rounded-lg px-3 text-sm font-semibold text-text-muted">
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
      <button onClick={handleApprove} disabled={loading !== null} className="h-10 rounded-xl bg-accent px-4 text-sm font-bold text-text-on-accent disabled:opacity-60">
        {loading === "approve" ? "..." : "Onayla"}
      </button>
      <button onClick={() => setRejecting(true)} disabled={loading !== null} className="h-10 rounded-xl border border-danger/40 px-4 text-sm font-bold text-danger hover:bg-danger-soft disabled:opacity-60">
        Reddet
      </button>
    </div>
  );
}
