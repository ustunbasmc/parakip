"use client";

import { useState } from "react";
import { approvePaymentRequest, rejectPaymentRequest } from "@/app/admin/payments/actions";

export function AdminPaymentActions({ requestId }: { requestId: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  async function handleApprove() {
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
          className="h-9 rounded-lg border border-border bg-bg px-2.5 text-xs"
        />
        <div className="flex gap-2">
          <button onClick={handleReject} disabled={loading === "reject"} className="text-xs font-bold text-danger">
            {loading === "reject" ? "..." : "Reddet"}
          </button>
          <button onClick={() => setRejecting(false)} className="text-xs text-text-muted">
            Vazgeç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button onClick={handleApprove} disabled={loading !== null} className="text-xs font-bold text-accent">
        {loading === "approve" ? "..." : "Onayla"}
      </button>
      <button onClick={() => setRejecting(true)} disabled={loading !== null} className="text-xs font-semibold text-danger">
        Reddet
      </button>
    </div>
  );
}
