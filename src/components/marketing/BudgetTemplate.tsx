"use client";

import { useEffect, useState } from "react";

/**
 * Tarayıcıda doldurulan aylık bütçe şablonu. Girilen rakamlar yalnızca bu
 * tarayıcıda (localStorage) saklanır; hiçbir sunucuya gönderilmez. Depo
 * kullanılamıyorsa şablon yine çalışır, yalnızca kaydedilmez.
 */

type GroupKey = "income" | "needs" | "wants" | "savings";

const GROUPS: { key: GroupKey; title: string; hint?: string; items: string[] }[] = [
  { key: "income", title: "Gelirler", items: ["Maaş 1", "Maaş 2", "Ek gelir / prim", "Kira geliri", "Diğer gelir"] },
  {
    key: "needs",
    title: "İhtiyaçlar",
    hint: "Ertelenemeyen giderler",
    items: [
      "Kira / konut kredisi",
      "Aidat",
      "Elektrik, su, doğalgaz",
      "İnternet ve telefon",
      "Market ve mutfak",
      "Ulaşım",
      "Sağlık, eğitim, çocuk",
      "Kredi ve kart asgari ödemeleri",
    ],
  },
  { key: "wants", title: "İstekler", hint: "Ertelenebilen harcamalar", items: ["Dışarıda yeme-içme", "Giyim", "Eğlence ve hobi", "Abonelikler", "Tatil ve diğer"] },
  { key: "savings", title: "Birikim ve borç kapatma", items: ["Acil durum fonu", "Birikim hedefi", "Asgarinin üzerindeki borç ödemesi"] },
];

const STORAGE_KEY = "parakip.budgetTemplate.v1";
const tl = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

type Values = Record<string, string>;
const keyOf = (g: GroupKey, i: number) => `${g}.${i}`;

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function load(): Values {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Values) : {};
  } catch {
    return {};
  }
}

export function BudgetTemplate({ xlsxHref }: { xlsxHref: string }) {
  const [values, setValues] = useState<Values>({});
  const [loaded, setLoaded] = useState(false);

  // Kayıtlı değerler yalnızca tarayıcıda okunur (sunucu çıktısı boş şablondur).
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setValues(load());
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    } catch {
      // Depo kullanılamıyor (ör. gizli sekme); şablon kaydetmeden çalışır.
    }
  }, [values, loaded]);

  const total = (g: GroupKey) => GROUPS.find((x) => x.key === g)!.items.reduce((s, _, i) => s + parseAmount(values[keyOf(g, i)]), 0);
  const income = total("income");
  const needs = total("needs");
  const wants = total("wants");
  const savings = total("savings");
  const left = income - needs - wants - savings;
  const pct = (v: number) => (income > 0 ? Math.round((v / income) * 100) : 0);

  const bars: { label: string; value: number; target: string; tone: string }[] = [
    { label: "İhtiyaçlar", value: pct(needs), target: "%50–60", tone: "bg-accent" },
    { label: "İstekler", value: pct(wants), target: "%20–30", tone: "bg-warning" },
    { label: "Birikim ve borç", value: pct(savings), target: "%15–20", tone: "bg-success" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-5">
        {GROUPS.map((g) => (
          <fieldset key={g.key} className="rounded-3xl border border-border bg-surface p-5">
            <legend className="px-1 text-sm font-bold text-text-primary">
              {g.title}
              {g.hint ? <span className="ml-2 font-normal text-text-muted">· {g.hint}</span> : null}
            </legend>
            <div className="mt-1 flex flex-col gap-2">
              {g.items.map((item, i) => {
                const k = keyOf(g.key, i);
                return (
                  <label key={k} className="flex items-center justify-between gap-3 text-sm text-text-secondary">
                    <span className="min-w-0 flex-1">{item}</span>
                    <span className="relative w-36 shrink-0">
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        value={values[k] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value.slice(0, 14) }))}
                        className="h-10 w-full rounded-xl border border-border bg-bg pl-3 pr-7 text-right text-sm font-semibold tabular-nums text-text-primary outline-none focus:border-accent"
                        aria-label={`${g.title}: ${item} (TL)`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">₺</span>
                    </span>
                  </label>
                );
              })}
              <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm font-bold text-text-primary">
                <span>Toplam</span>
                <span className="tabular-nums">{tl.format(total(g.key))}</span>
              </div>
            </div>
          </fieldset>
        ))}
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-3xl border border-border bg-surface p-5" aria-live="polite">
          <p className="text-sm font-bold text-text-primary">Özet</p>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            {[
              ["Toplam gelir", income],
              ["İhtiyaçlar", needs],
              ["İstekler", wants],
              ["Birikim ve borç", savings],
            ].map(([label, v]) => (
              <div key={label as string} className="flex justify-between text-text-secondary">
                <dt>{label}</dt>
                <dd className="font-semibold tabular-nums text-text-primary">{tl.format(v as number)}</dd>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-bold">
              <dt className="text-text-primary">Kalan</dt>
              <dd className={`tabular-nums ${left < 0 ? "text-expense" : "text-income"}`}>{tl.format(left)}</dd>
            </div>
          </dl>
          {left < 0 ? <p className="mt-2 text-xs text-expense">Giderler gelirini aşıyor; önce istekler kategorisini gözden geçir.</p> : null}
        </div>

        <div className="rounded-3xl border border-border bg-surface p-5">
          <p className="text-sm font-bold text-text-primary">Gelirine göre dağılım</p>
          <div className="mt-3 flex flex-col gap-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-text-secondary">{b.label}</span>
                  <span className="text-text-muted">
                    <strong className="text-text-primary">%{b.value}</strong> · öneri {b.target}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                  <div className={`h-full rounded-full ${b.tone}`} style={{ width: `${Math.min(100, b.value)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-muted">Öneriler 50/30/20 kuralının uyarlanmış hâlidir; kendi durumuna göre esnet.</p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <a href={xlsxHref} download className="rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-text-on-accent">
            Excel olarak indir
          </a>
          <button type="button" onClick={() => window.print()} className="rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text-primary">
            Yazdır
          </button>
          <button
            type="button"
            onClick={() => setValues({})}
            className="rounded-2xl px-3 py-2.5 text-sm font-semibold text-text-muted hover:text-text-primary"
          >
            Temizle
          </button>
        </div>
        <p className="text-xs text-text-muted print:hidden">Girdiğin rakamlar yalnızca bu tarayıcıda saklanır; bize gönderilmez.</p>
      </aside>
    </div>
  );
}
