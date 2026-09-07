"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

type Period = "monthly" | "yearly";

/**
 * İşletme aboneliği satın alma — Shopier ödeme akışını başlatır.
 * Kullanıcı Shopier'ın KENDİ barındırdığı ödeme sayfasına yönlendirilir
 * (kart bilgisi HİÇBİR ZAMAN Parakip sunucusuna/istemcisine uğramaz).
 *
 * DÜRÜST SINIRLAMA: Shopier'da GERÇEK, otomatik yenilenen abonelik
 * YOKTUR — bu bir MANUEL YENİLEMELİ paket satın almadır. Süre
 * dolduğunda erişim otomatik olarak kapanır, kullanıcı BURAYA dönüp
 * TEKRAR ödeme yapmalıdır. Bu, arayüzde AÇIKÇA belirtilir.
 */
export function BuySubscriptionCard({ spaceId }: { spaceId: string }) {
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
        body: JSON.stringify({ spaceId, period }),
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
    // Shopier'ın ödeme sayfasına yönlendiren, kendi kendine submit olan
    // form — kart bilgisi doğrudan Shopier'a gider, burada RENDER
    // edilmesiyle birlikte tarayıcı otomatik yönlenir.
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold text-text-primary">Shopier&apos;a yönlendiriliyorsun...</p>
        <div dangerouslySetInnerHTML={{ __html: formHtml }} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-4">
      <p className="text-sm font-semibold text-text-primary">İşletme aboneliği satın al</p>
      <p className="mt-1 text-xs text-text-muted">
        Sınırsız hesap, işlem, borç/alacak, müşteri ve tedarikçi kaydı. Ödeme, Shopier&apos;in güvenli sayfası
        üzerinden alınır — kart bilgin Parakip&apos;e hiç ulaşmaz.
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

      <Button onClick={handleStartCheckout} loading={loading} className="mt-3">
        Satın alma formunu aç
      </Button>
    </div>
  );
}
