"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SwipeToAction } from "@/components/SwipeToAction";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { PartyRow } from "@/lib/dashboard/customers";

export function PartyListItem({
  party,
  href,
  type,
}: {
  party: PartyRow;
  href: string;
  /** Belirtilirse kaydırmalı arşivleme etkinleşir (liste ekranlarında); detay linki olarak kullanılan yerlerde belirtilmez. */
  type?: "customer" | "supplier";
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const table = type === "supplier" ? "suppliers" : "customers";
    const { error: updateError } = await supabase.from(table).update({ is_archived: true }).eq("id", party.id);
    setLoading(false);
    setConfirmOpen(false);
    if (updateError) {
      setError("Arşivlenemedi.");
      return;
    }
    router.refresh();
  }

  const card = (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors active:bg-surface-muted ${
        party.isArchived ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">{party.name}</p>
        <p className="truncate text-xs text-text-muted">
          {party.phone || "Telefon yok"}
          {party.isArchived ? " · Arşivlenmiş" : ""}
        </p>
      </div>
    </Link>
  );

  if (!type || party.isArchived) return card;

  return (
    <div>
      {error ? <p className="mb-1.5 px-1 text-xs text-danger">{error}</p> : null}
      <SwipeToAction actionLabel="Arşivle" danger={false} onAction={() => setConfirmOpen(true)}>
        {card}
      </SwipeToAction>

      <ConfirmModal
        open={confirmOpen}
        title={type === "supplier" ? "Tedarikçiyi arşivle" : "Müşteriyi arşivle"}
        description={`"${party.name}" arşivlenecek. Bağlı satış/alış ve borç/alacak kayıtları korunur, hiçbir veri silinmez.`}
        confirmLabel="Arşivle"
        loading={loading}
        onConfirm={handleArchive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
