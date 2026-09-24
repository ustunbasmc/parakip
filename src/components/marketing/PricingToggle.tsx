"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

type Period = "monthly" | "yearly";

export interface PricingPlan {
  key: "free" | "home" | "business";
  name: string;
  badge?: string;
  highlight?: boolean;
  monthly: number;
  yearly: number;
  freeMonths: number;
  note?: string;
  features: ReactNode[];
  cta: string;
  href: { monthly: string; yearly: string };
}

const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const tl2 = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Fiyat kartları + aylık/yıllık seçici. Varsayılan YILLIK (rozetle birlikte).
 * Seçilen plan kayıt bağlantısına `?plan=` olarak eklenir; kullanıcı
 * onboarding sonunda aynı planın ödeme ekranına gelir.
 */
export function PricingToggle({ plans, maxFreeMonths }: { plans: PricingPlan[]; maxFreeMonths: number }) {
  const [period, setPeriod] = useState<Period>("yearly");

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1" role="group" aria-label="Ödeme dönemi">
          {(["monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              aria-pressed={period === p}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                period === p ? "bg-accent text-text-on-accent" : "text-text-secondary"
              }`}
            >
              {p === "monthly" ? "Aylık" : "Yıllık"}
              {p === "yearly" && maxFreeMonths > 0 ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    period === p ? "bg-text-on-accent/15 text-text-on-accent" : "bg-accent-soft text-accent"
                  }`}
                >
                  {maxFreeMonths} ay bedava
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-5 ${plans.length === 3 ? "md:grid-cols-3" : plans.length === 2 ? "mx-auto max-w-3xl md:grid-cols-2" : "mx-auto max-w-md"}`}>
        {plans.map((plan) => {
          const isFree = plan.key === "free";
          const yearly = period === "yearly" && !isFree;
          return (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-3xl bg-surface p-6 sm:p-7 ${
                plan.highlight ? "border-2 border-accent shadow-[var(--shadow-hero)]" : "border border-border"
              }`}
            >
              {plan.badge ? (
                <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-[11px] font-bold text-text-on-accent">{plan.badge}</span>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-bold ${plan.highlight ? "text-accent" : "text-text-secondary"}`}>{plan.name}</p>
                {yearly && plan.freeMonths > 0 ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[11px] font-extrabold text-success">
                    {plan.freeMonths} ay bedava
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-text-primary">
                {isFree ? "₺0" : tl.format(yearly ? plan.yearly : plan.monthly)}
                <span className="text-base font-semibold text-text-muted">{isFree ? "" : yearly ? "/yıl" : "/ay"}</span>
              </p>
              <p className="mt-1 min-h-[1rem] text-xs text-text-muted">
                {isFree
                  ? "Süre sınırı yok, kart gerekmez"
                  : yearly
                    ? `Aylık ${tl2.format(plan.yearly / 12)}'ye gelir${plan.note ? ` · ${plan.note}` : ""}`
                    : `${plan.note ? `${plan.note} · ` : ""}İstediğin zaman bırak`}
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-text-secondary">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckIcon size={15} className="mt-0.5 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href[period]}
                className={`mt-6 block rounded-2xl py-3 text-center text-sm font-bold ${
                  plan.highlight ? "bg-accent text-text-on-accent" : "border border-border text-text-primary hover:bg-surface-muted"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
