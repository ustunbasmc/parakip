"use client";

import { useState, type ReactNode } from "react";

interface InsightTab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Grafik kartları sayfayı gereksiz uzatmasın diye: mobil/tablette TEK bir
 * kart içinde sekmelerle, geniş ekranda (lg+) yan yana iki kart olarak
 * gösterilir (ilki 2 sütun). Her grafik YALNIZCA BİR KEZ çizilir; sekme
 * değişimi ve kırılım noktası yalnızca CSS görünürlüğünü değiştirir.
 */
export function InsightsPanel({ tabs, title = "Analiz" }: { tabs: [InsightTab, InsightTab]; title?: string }) {
  const [active, setActive] = useState(tabs[0].key);

  return (
    <section
      aria-label={title}
      className="surface-card animate-rise min-w-0 rounded-3xl p-3.5 sm:p-5 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:border-0 lg:bg-transparent lg:bg-none lg:p-0 lg:shadow-none"
    >
      <div role="tablist" aria-label={title} className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1 lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`truncate rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${
              active === t.key ? "bg-surface text-text-primary shadow-[var(--shadow-card)]" : "text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          aria-label={t.label}
          className={`${active === t.key ? "block" : "hidden"} min-w-0 lg:block lg:rounded-3xl lg:border lg:border-border lg:bg-[image:var(--gradient-card)] lg:p-5 lg:shadow-[var(--shadow-card)] ${
            i === 0 ? "lg:col-span-2" : ""
          }`}
        >
          <h2 className="mb-4 hidden text-[15px] font-bold text-text-primary lg:block">{t.label}</h2>
          {t.content}
        </div>
      ))}
    </section>
  );
}
