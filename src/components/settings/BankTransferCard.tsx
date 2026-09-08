"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  createManualPaymentRequest,
  generateReferenceCode,
  type PlanKind,
  type BillingPeriod,
} from "@/lib/payments/manualBankTransfer";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CopyIcon, CheckCircleIcon } from "@/components/icons";

/**
 * Banka havalesi/EFT ile MANUEL ödeme — kart ile ödeme sağlayıcısı
 * onayı beklenirken (veya kalıcı bir alternatif olarak) kullanılır.
 *
 * İKİ AŞAMALI AKIŞ (bilinçli tasarım — TEK adımda talep oluşturmak
 * YANLIŞTIR): (1) "Havale bilgilerini göster" YALNIZCA bir referans
 * kodu üretip GÖSTERİR — bu adımda VERİTABANINA HİÇBİR ŞEY YAZILMAZ,
 * kullanıcı yalnızca bilgiye BAKMAK için tıklamış olabilir (aksi halde
 * her tıklama admin paneline gereksiz bir "hayalet" talep düşürür).
 * (2) Kullanıcı GERÇEKTEN havaleyi yaptıktan SONRA "Ödemeyi yaptım,
 * bildir" der — YALNIZCA bu an bir `manual_payment_requests` satırı
 * oluşturulur.
 *
 * DÜRÜST AKIŞ: subscriptions'a HİÇBİR ZAMAN buradan yazılmaz — abonelik
 * YALNIZCA platform admin banka hesabını kontrol edip talebi
 * onayladığında (bkz. /admin/payments) aktifleşir.
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
  const [step, setStep] = useState<"select" | "show" | "submitted">("select");
  const [referenceCode, setReferenceCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const amount = period === "monthly" ? monthlyPrice : yearlyPrice;

  function handleShowDetails() {
    // YALNIZCA client-side bir kod üretir — veritabanına HİÇBİR ŞEY
    // YAZILMAZ, kullanıcı henüz ödeme yapmamış olabilir.
    setReferenceCode(generateReferenceCode());
    setStep("show");
  }

  async function handleConfirmPaid() {
    setError(null);
    setLoading(true);
    const supabase = createClient();

    // Referans kodu çakışması (UNIQUE kısıt, son derece nadir) —
    // yalnızca bu durumda YENİ bir kod üretip tekrar dener.
    let code = referenceCode;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await createManualPaymentRequest(supabase, {
        userId,
        plan,
        spaceId,
        period,
        amountCents: amount * 100,
        referenceCode: code,
      });
      if ("ok" in result) {
        setLoading(false);
        setStep("submitted");
        return;
      }
      if (!result.error.includes("duplicate key") && !result.error.includes("unique")) {
        setError(result.error);
        setLoading(false);
        return;
      }
      code = generateReferenceCode();
      setReferenceCode(code);
    }
    setError("Talep oluşturulamadı, lütfen tekrar dene.");
    setLoading(false);
  }

  function handleCopyIban() {
    navigator.clipboard.writeText(bankIban.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "submitted") {
    return (
      <div className="rounded-2xl border border-accent bg-accent-soft p-4">
        <div className="flex items-center gap-2">
          <CheckCircleIcon size={18} className="text-accent" />
          <p className="text-sm font-bold text-text-primary">Bildirimin alındı</p>
        </div>
        <p className="mt-2 text-sm text-text-secondary">
          Ekibimiz banka hesabını kontrol edip <strong>{referenceCode}</strong> referans kodlu ödemeni
          eşleştirdikten sonra aboneliğini aktif edecek — bu genellikle <strong>1 iş günü içinde</strong>{" "}
          tamamlanır, anında olmaz.
        </p>
      </div>
    );
  }

  if (step === "show") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-bold text-text-primary">Havale/EFT bilgileri</p>
        <p className="mt-1 text-sm text-text-secondary">
          Aşağıdaki bilgilerle <strong>{amount} ₺</strong> gönder. Açıklama kısmına <strong>mutlaka</strong>{" "}
          referans kodunu yaz — aksi halde ödemen bulunamayabilir.
        </p>
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-muted p-3">
          <div>
            <p className="text-xs text-text-muted">Referans kodu (açıklamaya yaz)</p>
            <p className="text-lg font-bold tabular-nums text-accent">{referenceCode}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Alıcı</p>
            <p className="text-sm font-semibold text-text-primary">
              {bankAccountHolder} — {bankName}
            </p>
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

        {error ? <ErrorBanner message={error} /> : null}

        <p className="mt-3 text-xs text-text-muted">
          Havaleyi <strong>gönderdikten sonra</strong> aşağıdaki butona bas — bu, talebini ekibimize
          bildirir. Yalnızca bilgilere bakmak için bastıysan, henüz bir şey yapmana gerek yok.
        </p>
        <Button onClick={handleConfirmPaid} loading={loading} className="mt-3">
          Ödemeyi yaptım, bildir
        </Button>
        <button onClick={() => setStep("select")} className="mt-2 w-full text-center text-xs text-text-muted">
          Vazgeç
        </button>
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

      <Button onClick={handleShowDetails} className="mt-3">
        Havale bilgilerini göster
      </Button>
    </div>
  );
}
