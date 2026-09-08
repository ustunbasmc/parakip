"use client";

import { useEffect, useRef, useState } from "react";
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

interface CheckoutData {
  actionUrl: string;
  fields: Record<string, string>;
}

/**
 * Ev Premium VEYA İşletme Premium satın alma — Shopier ödeme akışını
 * başlatır. Kullanıcı Shopier'ın KENDİ barındırdığı ödeme sayfasına
 * yönlendirilir (kart bilgisi Parakip'e hiç ulaşmaz).
 *
 * ÖNEMLİ TEKNİK NOT: form GERÇEK bir React `<form>` elemanı olarak
 * render edilip `useEffect` içinde `formRef.current.submit()` ile
 * gönderilir — `dangerouslySetInnerHTML` ile eklenen bir `<script>`
 * KULLANILMAZ, çünkü tarayıcılar `innerHTML` üzerinden DOM'a eklenen
 * `<script>` etiketlerini GÜVENLİK GEREĞİ hiç çalıştırmaz (önceki
 * sürümde tam olarak bu nedenle form asla otomatik gönderilmiyordu).
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
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // checkoutData set edildiği AN, gerçek DOM formu render edilir edilmez
  // otomatik gönderilir — kullanıcının ekstra bir şeye tıklamasına GEREK
  // YOKTUR, "Shopier'a yönlendiriliyorsun..." mesajı GERÇEKTEN doğrudur.
  useEffect(() => {
    if (checkoutData && formRef.current) {
      formRef.current.submit();
    }
  }, [checkoutData]);

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
      setCheckoutData({ actionUrl: data.actionUrl, fields: data.fields });
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  if (checkoutData) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-text-primary">Shopier&apos;a yönlendiriliyorsun...</p>
        <p className="mt-1 text-xs text-text-muted">
          Birkaç saniye içinde yönlenmezse{" "}
          <button type="button" onClick={() => formRef.current?.submit()} className="font-semibold text-accent underline">
            buraya tıkla
          </button>
          .
        </p>
        <form ref={formRef} method="POST" action={checkoutData.actionUrl} className="hidden">
          {Object.entries(checkoutData.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
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
