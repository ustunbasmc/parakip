"use client";

import { useState } from "react";
import { cancelTransactionAsAdmin } from "@/app/admin/users/[id]/actions";

export function AdminCancelTransactionButton({ transactionId, spaceId }: { transactionId: string; spaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await cancelTransactionAsAdmin(transactionId, spaceId);
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  if (confirmOpen) {
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={handleConfirm} disabled={loading} className="text-xs font-bold text-danger">
          {loading ? "..." : "Onayla"}
        </button>
        <button onClick={() => setConfirmOpen(false)} className="text-xs text-text-muted">
          Vazgeç
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirmOpen(true)} className="text-xs font-semibold text-danger">
      İptal et
    </button>
  );
}
