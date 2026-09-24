/**
 * Tanıtım sayfalarındaki telefon görünümü. Uygulamanın gerçek ana ekran
 * düzenini (bakiye kartı, aylık özet, son hareketler, alt menü) aynı renk
 * belirteçleriyle ÇİZER; ekran görüntüsü değildir, bu yüzden açık/koyu
 * temaya uyar ve hızlı yüklenir. İçerik tamamen ÖRNEKTİR ve altında
 * "Örnek görünüm" yazar. Ekran okuyuculardan gizlenir.
 */

type Variant = "home" | "business";

const DATA: Record<
  Variant,
  {
    space: string;
    total: string;
    net: string;
    income: string;
    expense: string;
    month: string;
    bullets: { tone: "good" | "info"; text: string }[];
    rows: { icon: string; title: string; sub: string; amount: string; positive?: boolean }[];
    toast: { title: string; body: string };
  }
> = {
  home: {
    space: "Ev",
    total: "₺48.320,00",
    net: "₺41.870",
    income: "+₺32.500",
    expense: "−₺18.240",
    month: "Eylül özeti",
    bullets: [
      { tone: "good", text: "Geçen aya göre %12 daha az harcadın." },
      { tone: "info", text: "En çok Market için harcadın (₺4.850)." },
    ],
    rows: [
      { icon: "🛒", title: "Market", sub: "Bugün · Kredi kartı", amount: "−₺645,90" },
      { icon: "💼", title: "Maaş", sub: "15 Eyl · Banka", amount: "+₺32.500,00", positive: true },
      { icon: "🏠", title: "Kira", sub: "5 Eyl · Otomatik", amount: "−₺12.000,00" },
    ],
    toast: { title: "Kira ödemen yarın", body: "₺12.000 · Ev" },
  },
  business: {
    space: "Kuaför Ayşe",
    total: "₺126.450,00",
    net: "₺98.200",
    income: "+₺84.300",
    expense: "−₺51.760",
    month: "Eylül özeti",
    bullets: [
      { tone: "good", text: "Bu ay geliriniz geçen aya göre %9 arttı." },
      { tone: "info", text: "Tahsil edilecek alacak: ₺7.400 (3 müşteri)." },
    ],
    rows: [
      { icon: "✂️", title: "Günlük kasa", sub: "Bugün · Nakit", amount: "+₺3.250,00", positive: true },
      { icon: "🧴", title: "Malzeme alımı", sub: "Dün · Tedarikçi", amount: "−₺2.180,00" },
      { icon: "🧾", title: "Dükkan kirası", sub: "1 Eyl · Otomatik", amount: "−₺18.000,00" },
    ],
    toast: { title: "Alacak vadesi geldi", body: "Mehmet Bey · ₺2.400" },
  },
};

export function PhoneMockup({ variant = "home", className = "" }: { variant?: Variant; className?: string }) {
  const d = DATA[variant];
  return (
    <figure className={`relative mx-auto w-[280px] sm:w-[300px] ${className}`} aria-hidden="true">
      <div className="relative rounded-[2.9rem] bg-gradient-to-b from-[#2a3550] to-[#121a2c] p-[11px] shadow-[0_40px_80px_-24px_rgba(13,148,136,0.45),0_0_0_1px_rgba(255,255,255,0.18)_inset,0_0_0_1px_rgba(148,163,184,0.25)]">
        {/* yan tuşlar */}
        <span className="absolute -left-[3px] top-24 h-10 w-[3px] rounded-l bg-[#1c2438]" />
        <span className="absolute -left-[3px] top-36 h-14 w-[3px] rounded-l bg-[#1c2438]" />
        <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-[#1c2438]" />

        <div className="relative h-[580px] overflow-hidden rounded-[2.2rem] bg-bg sm:h-[610px]">
          {/* durum çubuğu + çentik */}
          <div className="relative flex h-9 items-center justify-between px-6 text-[11px] font-bold text-text-primary">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2 h-[22px] w-[88px] -translate-x-1/2 rounded-full bg-[#0b1222]" />
            <span className="flex items-center gap-1">
              <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor">
                <rect x="0" y="6" width="2.5" height="4" rx="0.6" />
                <rect x="4" y="4" width="2.5" height="6" rx="0.6" />
                <rect x="8" y="2" width="2.5" height="8" rx="0.6" />
                <rect x="12" y="0" width="2.5" height="10" rx="0.6" />
              </svg>
              <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
                <rect x="0.5" y="0.5" width="18" height="9" rx="2.5" stroke="currentColor" opacity="0.5" />
                <rect x="2" y="2" width="13" height="6" rx="1.5" fill="currentColor" />
                <rect x="19.8" y="3.3" width="1.6" height="3.4" rx="0.8" fill="currentColor" opacity="0.5" />
              </svg>
            </span>
          </div>

          <div className="flex flex-col gap-2.5 px-3.5 pt-1.5">
            {/* üst bar */}
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-bold text-text-secondary">{d.space} ▾</span>
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-text-secondary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-expense ring-2 ring-bg" />
              </span>
            </div>

            {/* bakiye kartı */}
            <div
              className="rounded-2xl border p-3.5"
              style={{
                backgroundImage: "var(--gradient-hero)",
                boxShadow: "var(--shadow-hero)",
                borderColor: "color-mix(in srgb, var(--color-accent) 28%, var(--color-border))",
              }}
            >
              <p className="text-[10px] font-semibold text-text-secondary">Toplam varlık</p>
              <p className="mt-1 text-[26px] font-extrabold leading-none tracking-tight text-text-primary">{d.total}</p>
              <span className="mt-2 inline-flex rounded-full bg-[var(--tile-bg)] px-2 py-1 text-[9px] font-semibold text-text-secondary">
                Net değer: <span className="ml-1 font-bold text-text-primary">{d.net}</span>
                <span className="ml-1 text-accent">→</span>
              </span>
            </div>

            {/* gelir / gider */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-surface p-2.5">
                <p className="text-[9px] text-text-muted">Bu ay gelir</p>
                <p className="text-[13px] font-extrabold text-income">{d.income}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-2.5">
                <p className="text-[9px] text-text-muted">Bu ay gider</p>
                <p className="text-[13px] font-extrabold text-expense">{d.expense}</p>
              </div>
            </div>

            {/* aylık özet */}
            <div className="rounded-2xl border border-border bg-surface p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[10px] text-accent">✦</span>
                <p className="text-[11px] font-bold text-text-primary">{d.month}</p>
              </div>
              <ul className="flex flex-col gap-1">
                {d.bullets.map((b) => (
                  <li key={b.text} className="flex gap-1.5 text-[10px] leading-snug text-text-secondary">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${b.tone === "good" ? "bg-income" : "bg-accent"}`} />
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* son hareketler */}
            <div className="rounded-2xl border border-border bg-surface p-2">
              <p className="px-1 pb-1 text-[10px] font-bold text-text-primary">Son hareketler</p>
              {d.rows.map((r) => (
                <div key={r.title} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-[13px]">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-text-primary">{r.title}</span>
                    <span className="block text-[9px] text-text-muted">{r.sub}</span>
                  </span>
                  <span className={`text-[11px] font-bold ${r.positive ? "text-income" : "text-text-primary"}`}>{r.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* bildirim banner'ı (kilit ekranı/üst bildirim gibi) */}
          <div className="absolute inset-x-2.5 top-1.5 z-10 rounded-2xl border border-border bg-surface/95 p-2.5 shadow-xl backdrop-blur">
            <div className="flex items-start gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-192.png" alt="" width={26} height={26} className="rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between text-[10px] font-bold text-text-primary">
                  {d.toast.title}
                  <span className="font-medium text-text-muted">şimdi</span>
                </span>
                <span className="block text-[10px] text-text-muted">{d.toast.body}</span>
              </span>
            </div>
          </div>

          {/* alt menü */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-border bg-bg/95 px-2 pb-5 pt-2 backdrop-blur">
            {["Ana Sayfa", "Hesaplar", "+", "Hareketler", "Daha Fazla"].map((l, i) =>
              l === "+" ? (
                <span key={l} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-lg font-bold text-text-on-accent">
                  +
                </span>
              ) : (
                <span key={l} className={`flex flex-col items-center gap-0.5 text-[8px] font-semibold ${i === 0 ? "text-accent" : "text-text-muted"}`}>
                  <span className={`h-3.5 w-3.5 rounded-[4px] border-[1.5px] ${i === 0 ? "border-accent" : "border-text-muted"}`} />
                  {l}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-[11px] text-text-muted">Örnek görünüm</figcaption>
    </figure>
  );
}
