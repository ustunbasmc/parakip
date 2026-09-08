"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createManualPaymentRequest, type PlanKind, type BillingPeriod } from "@/lib/payments/manualBankTransfer";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CopyIcon, CheckCircleIcon } from "@/components/icons";

/**
 * Banka havalesi/EFT ile MANUEL ödeme — kart ile ödeme sağlayıcısı
 * onayı beklenirken (veya kalıcı bir alternatif olarak) kullanılır.
 *
 * DÜRÜST AKIŞ: Bu bileşen subscriptions'a HİÇBİR ŞEY YAZMAZ — yalnızca
 * bir "talep" oluşturur. Abonelik, YALNIZCA platform admin banka
 * hesabını kontrol edip talebi onayladığında (bkz. /admin/payments)
 * aktifleşir. Kullanıcıya bu süreç AÇIKÇA anlatılır — "ödeme
 * bildirdim" demek "ödeme onaylandı" demek DEĞİLDİR.
 */
export function BankTransferCard({
  userId,
  spaceId,
  plan,
  monthlyPrice,
  yearlyPrice,
  bankAccountHolder,
  bankIban,
  bankName,
}: {
  userId: string;
  spaceId: string;
  plan: PlanKind;
  /** TL cinsinden tam sayı (kuruş değil), ör. 99 — server tarafında env'den okunur. */
  monthlyPrice: number;
  yearlyPrice: number;
  bankAccountHolder: string;
  bankIban: string;
  bankName: string;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const amount = period === "monthly" ? monthlyPrice : yearlyPrice;

  async function handleCreateRequest() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const result = await createManualPaymentRequest(supabase, {
      userId,
      plan,
      spaceId,
      period,
      amountCents: amount * 100,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setReferenceCode(result.referenceCode);
  }

  function handleCopyIban() {
    navigator.clipboard.writeText(bankIban.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (referenceCode) {
    return (
      <div className="rounded-2xl border border-accent bg-accent-soft p-4">
        <div className="flex items-center gap-2">
          <CheckCircleIcon size={18} className="text-accent" />
          <p className="text-sm font-bold text-text-primary">Talebin oluşturuldu</p>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Aşağıdaki bilgilerle <strong>{amount} ₺</strong> havale/EFT yap. Açıklama kısmına{" "}
          <strong>mutlaka</strong> referans kodunu yaz — aksi halde ödemen bulunamayabilir.
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface p-3">
          <div>
            <p className="text-xs text-text-muted">Referans kodu (açıklamaya yaz)</p>
            <p className="text-lg font-bold tabular-nums text-accent">{referenceCode}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Alıcı</p>
            <p className="text-sm font-semibold text-text-primary">{bankAccountHolder} — {bankName}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">IBAN</p>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold tabular-nums text-text-primary">{bankIban}</p>
              <button onClick={handleCopyIban} className="text-xs font-semibold text-accent">
                {copied ? "Kopyalandı" : <CopyIcon size={14} />}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Havale yaptıktan sonra ekibimiz banka hesabını kontrol edip aboneliğini aktif eder — bu genellikle{" "}
          <strong>1 iş günü içinde</strong> tamamlanır, anında olmaz.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-4">
      <p className="text-sm font-semibold text-text-primary">Banka havalesi/EFT ile öde</p>
      <p className="mt-1 text-xs text-text-muted">
        Kart ile ödeme şu an geçici olarak kullanılamıyor. Bunun yerine banka hesabımıza havale/EFT
        yapabilirsin — ekibimiz kontrol edip aboneliğini elle aktif eder (anında değil, genellikle 1 iş günü
        içinde).
      </p>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="mt-3 flex gap-1 rounded-full bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => setPeriod("monthly")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${period === "monthly" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
        >
          Aylık
        </button>
        <button
          type="button"
          onClick={() => setPeriod("yearly")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold ${period === "yearly" ? "bg-accent text-text-on-accent" : "text-text-secondary"}`}
        >
          Yıllık
        </button>
      </div>

      <p className="mt-3 text-center text-2xl font-extrabold text-text-primary">
        {amount} ₺<span className="text-sm font-normal text-text-muted">{period === "monthly" ? " / ay" : " / yıl"}</span>
      </p>

      <Button onClick={handleCreateRequest} loading={loading} className="mt-3">
        Havale bilgilerini göster
      </Button>
    </div>
  );
}
