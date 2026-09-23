"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createBudget } from "@/lib/api/financial-rpc";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CopyIcon } from "@/components/icons";

export interface CopyCandidate {
  categoryId: string | null;
  name: string;
  amountCents: number;
}

/**
 * Önceki ayın bütçelerini seçili aya kopyalar. Yalnızca hedef ayda HENÜZ
 * OLMAYAN bütçeler aday olarak gelir (sunucuda hesaplanır). Her bütçe
 * mevcut create_budget RPC'si ile TEK TEK oluşturulur — yetki kontrolü,
 * çakışma kuralı ve audit_log kaydı aynen işler; yeni bir yazma yolu yoktur.
 * Bir bütçe başarısız olursa diğerleri yine denenir ve sonuç özetlenir.
 */
export function CopyBudgetsButton({
  bookId,
  targetMonth,
  targetLabel,
  sourceLabel,
  candidates,
}: {
  bookId: string;
  /** "YYYY-MM-01" */
  targetMonth: string;
  targetLabel: string;
  sourceLabel: string;
  candidates: CopyCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);
  const runningRef = useRef(false);

  async function handleCopy() {
    if (runningRef.current) return;
    runningRef.current = true;
    setLoading(true);
    const supabase = createClient();
    let ok = 0;
    const failed: string[] = [];
    for (const c of candidates) {
      try {
        const { error } = await createBudget(supabase, {
          p_book_id: bookId,
          p_amount_cents: c.amountCents,
          p_period_month: targetMonth,
          p_category_id: c.categoryId,
        });
        if (error) failed.push(c.name);
        else ok++;
      } catch {
        failed.push(c.name);
      }
    }
    runningRef.current = false;
    setLoading(false);
    setResult({ ok, failed });
    if (ok > 0) router.refresh();
    if (failed.length === 0) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-bold text-text-secondary transition-colors hover:bg-surface-muted"
      >
        <CopyIcon size={14} />
        {sourceLabel} bütçelerini kopyala
      </button>

      <Modal open={open} title="Bütçeleri kopyala" onClose={() => (loading ? undefined : setOpen(false))}>
        <div className="flex flex-col gap-4 pb-2 pt-3">
          <p className="text-sm text-text-secondary">
            <strong className="text-text-primary">{sourceLabel}</strong> ayındaki şu bütçeler{" "}
            <strong className="text-text-primary">{targetLabel}</strong> için aynı tutarlarla oluşturulacak:
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {candidates.map((c) => (
              <li key={c.categoryId ?? "__total__"} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium text-text-primary">{c.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-text-primary">{formatCentsAsCurrency(c.amountCents, "TRY")}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">
            {targetLabel} ayında zaten bütçesi olan kalemler listeye alınmadı. Kopyalanan bütçeleri sonradan tek tek düzenleyebilirsin.
          </p>
          {result && result.failed.length > 0 ? (
            <ErrorBanner
              message={`${result.ok} bütçe kopyalandı. Kopyalanamayanlar: ${result.failed.join(", ")}. Bu kalemler için bütçe zaten eklenmiş olabilir; sayfayı yenileyip kontrol et.`}
            />
          ) : null}
          <Button onClick={handleCopy} loading={loading} disabled={candidates.length === 0}>
            {candidates.length} bütçeyi kopyala
          </Button>
        </div>
      </Modal>
    </>
  );
}
