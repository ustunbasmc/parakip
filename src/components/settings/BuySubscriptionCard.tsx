"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

type Period = "monthly" | "yearly";
type PlanKind = "home_premium" | "business";

const COPY: Record<PlanKind, { title: string; description: string }> = {
  home_premium: {
    title: "Ev Premium satın al",
    description: "Sınırsız hesap ve genişletilmiş özellikler. Yalnızca bu alanın sahibi satın alabilir.",
  },
  business: {
    title: "İşletme Premium satın al",
    description: "Sınırsız hesap, işlem, borç/alacak, müşteri ve tedarikçi kaydı.",
  },
};

/**
 * Ev Premium VEYA İşletme Premium satın alma — Shopier ödeme akışını
 * başlatır. Kullanıcı Shopier'ın KENDİ barındırdığı ödeme sayfasına
 * yönlendirilir (kart bilgisi Parakip'e hiç ulaşmaz).
 *
 * DÜRÜST SINIRLAMA: Shopier'da GERÇEK, otomatik yenilenen abonelik
 * YOKTUR — bu bir MANUEL YENİLEMELİ paket satın almadır.
 */
export function BuySubscriptionCard({
  spaceId,
  plan,
  monthlyPrice,
  yearlyPrice,
}: {
  spaceId: string;
  plan: PlanKind;
  /** TL cinsinden, ör. "99,00" — sunucu tarafında env'den okunup buraya biçimlenmiş olarak geçirilir. */
  monthlyPrice: string;
  yearlyPrice: string;
}) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formHtml, setFormHtml] = useState<string | null>(null);

  async function handleStartCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/shopier/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId, plan, period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ödeme formu başlatılamadı.");
        setLoading(false);
        return;
      }
      setFormHtml(data.formHtml);
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  if (formHtml) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text-primary">Shopier&apos;a yönlendiriliyorsun...</p>
        <div dangerouslySetInnerHTML={{ __html: formHtml }} />
      </div>
    );
  }

  const copy = COPY[plan];

  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-4">
      <p className="text-sm font-semibold text-text-primary">{copy.title}</p>
      <p className="mt-1 text-xs text-text-muted">
        {copy.description} Ödeme, Shopier&apos;in güvenli sayfası üzerinden alınır — kart bilgin Parakip&apos;e
        hiç ulaşmaz.
      </p>
      <p className="mt-2 rounded-xl bg-warning-soft p-2.5 text-xs text-warning">
        Bu abonelik <strong>otomatik yenilenmez</strong>. Süre dolduğunda erişimin kapanır, buraya dönüp tekrar
        satın almalısın.
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
        {period === "monthly" ? monthlyPrice : yearlyPrice} ₺
        <span className="text-sm font-normal text-text-muted">{period === "monthly" ? " / ay" : " / yıl"}</span>
      </p>

      <Button onClick={handleStartCheckout} loading={loading} className="mt-3">
        Satın almaya git
      </Button>
    </div>
  );
}
