import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { BarSeries, Card, CardHeader, ErrorBox, PageHeader, ShareBars, StatCard } from "@/components/admin/ui";
import { getAuthUsers, requestNow } from "@/lib/admin/data";

type Stats = {
  days: number;
  funnel: { signed_up: number; confirmed: number; has_space: number; has_account: number; first_tx: number; returned: number; premium: number };
  activity: { dau: number; wau: number; mau: number; signed_in_7d: number; confirmed_total: number };
  adoption: {
    books: number;
    with_tx: number;
    with_budget: number;
    with_debt: number;
    with_recurring_debt: number;
    with_recurring_tx: number;
    with_investment: number;
    with_goal: number;
    shared_spaces: number;
    tickets: number;
  };
  weekly: { week: string; signups: number; activated: number }[];
};

const PERIODS = [7, 30, 90] as const;
const shortDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * Kullanım ölçümü — mevcut verilerden (auth.users, alanlar, audit_log…)
 * veritabanında hesaplanır (admin_usage_stats, migration 0067). Ayrı bir
 * izleme/çerez yoktur; kişi bazında veri gösterilmez, yalnızca toplamlar.
 */
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = (PERIODS as readonly number[]).includes(Number(params.days)) ? Number(params.days) : 30;
  const [{ data, error }, authUsers] = await Promise.all([
    getAdminDbClient().rpc("admin_usage_stats", { p_days: days }),
    getAuthUsers(),
  ]);
  const s = data as Stats | null;

  // Kayıt kaynakları: dönem içinde kayıt olanların geldiği sayfa ve kampanya
  // (tanıtım sayfalarındaki bağlantılardan; çerez kullanılmaz).
  const since = requestNow() - days * 86_400_000;
  const recent = [...authUsers.values()].filter((u) => new Date(u.createdAt).getTime() >= since);
  const countBy = (key: (u: (typeof recent)[number]) => string) => {
    const m = new Map<string, number>();
    for (const u of recent) m.set(key(u), (m.get(key(u)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  };
  const PAGE_LABELS: Record<string, string> = {
    "/": "Ana sayfa",
    "/ev-butcesi": "Ev bütçesi sayfası",
    "/esnaf-gelir-gider": "Esnaf sayfası",
    "/butce-sablonu": "Bütçe şablonu",
    "/rehber": "Rehber",
  };
  const bySourcePage = countBy((u) => {
    const p = u.signupSource?.page;
    if (!p) return "Bilinmiyor / doğrudan kayıt";
    return PAGE_LABELS[p] ?? (p.startsWith("/rehber/") ? "Rehber makalesi" : p);
  });
  const byCampaign = countBy((u) =>
    u.signupSource?.utm_source ? `${u.signupSource.utm_source}${u.signupSource.utm_campaign ? ` · ${u.signupSource.utm_campaign}` : ""}` : "Kampanyasız"
  );

  const steps = s
    ? [
        { label: "Kayıt oldu", value: s.funnel.signed_up, hint: "Formu dolduran herkes" },
        { label: "E-postasını onayladı", value: s.funnel.confirmed, hint: "Onaylamayan giriş yapamaz" },
        { label: "Alan oluşturdu / katıldı", value: s.funnel.has_space, hint: "Onboarding tamamlandı" },
        { label: "Hesap ekledi", value: s.funnel.has_account, hint: "Alanında en az bir hesap var" },
        { label: "İlk işlemini girdi", value: s.funnel.first_tx, hint: "Asıl aktivasyon adımı" },
        { label: "Ertesi gün(ler) geri döndü", value: s.funnel.returned, hint: "Kayıttan 1 gün sonra giriş yaptı" },
        { label: "Premium'a geçti", value: s.funnel.premium, hint: "Aktif Ev veya İşletme Premium" },
      ]
    : [];

  const adoption = s
    ? [
        { label: "Gelir/gider kaydı", value: s.adoption.with_tx },
        { label: "Bütçe", value: s.adoption.with_budget },
        { label: "Borç/alacak", value: s.adoption.with_debt },
        { label: "Yatırım", value: s.adoption.with_investment },
        { label: "Birikim hedefi", value: s.adoption.with_goal },
        { label: "Tekrarlayan gelir/gider", value: s.adoption.with_recurring_tx },
        { label: "Tekrarlayan borç", value: s.adoption.with_recurring_debt },
        { label: "Birden fazla üye", value: s.adoption.shared_spaces },
      ].sort((a, b) => b.value - a.value)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kullanım"
        description="Kayıttan aktif kullanıma geçiş, aktiflik ve özellik kullanımı. Yalnızca toplam sayılar; kişi bazında izleme yapılmaz."
        actions={
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={p === 30 ? "/admin/analytics" : `/admin/analytics?days=${p}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === p ? "bg-accent text-text-on-accent" : "text-text-secondary hover:bg-surface-muted"}`}
              >
                {p} gün
              </Link>
            ))}
          </div>
        }
      />

      {error || !s ? (
        <ErrorBox message={`İstatistikler yüklenemedi${error ? `: ${error.message}` : ""}.`} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Günlük aktif" value={s.activity.dau} hint="son 24 saatte kayıt giren" />
            <StatCard label="Haftalık aktif" value={s.activity.wau} hint={`son 7 gün · ${s.activity.signed_in_7d} giriş yaptı`} />
            <StatCard label="Aylık aktif" value={s.activity.mau} hint={`${s.activity.confirmed_total} onaylı kullanıcıdan`} />
            <StatCard
              label="Aktivasyon"
              value={`%${pct(s.funnel.first_tx, s.funnel.confirmed)}`}
              hint={`son ${s.days} günde onaylı → ilk işlem`}
              tone={pct(s.funnel.first_tx, s.funnel.confirmed) >= 40 ? "success" : "warning"}
            />
          </div>

          <Card>
            <CardHeader title="Aktivasyon hunisi" subtitle={`Son ${s.days} günde kayıt olanlar`} />
            <ol className="flex flex-col gap-3">
              {steps.map((step, i) => {
                const width = pct(step.value, steps[0].value);
                const prev = i > 0 ? steps[i - 1].value : null;
                const drop = prev !== null && prev > 0 ? 100 - pct(step.value, prev) : null;
                return (
                  <li key={step.label}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold text-text-primary">{step.label}</span>
                        <span className="ml-2 text-xs text-text-muted">{step.hint}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-text-secondary">
                        <strong className="text-text-primary">{step.value}</strong>
                        {drop !== null && drop > 0 ? <span className="ml-2 text-xs text-danger">−%{drop}</span> : null}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(width, step.value > 0 ? 2 : 0)}%` }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-text-muted">
              En büyük düşüş (kırmızı) iyileştirilecek ilk yerdir. Örneğin &quot;hesap ekledi → ilk işlem&quot; arasındaki kayıp
              büyükse ilk işlemi kolaylaştırmak (örnek veri, rehber) en çok etkiyi yapar.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Haftalık kayıt ve aktivasyon" subtitle="Son 12 hafta · aktive = kayıttan sonraki 7 gün içinde ilk işlem" />
              {s.weekly.length === 0 ? (
                <p className="text-sm text-text-muted">Bu dönemde kayıt yok.</p>
              ) : (
                <>
                  <BarSeries
                    label="Haftalık kayıt"
                    data={s.weekly.map((w) => {
                      const [y, m, d] = w.week.split("-").map(Number);
                      return { key: w.week, label: shortDay.format(new Date(Date.UTC(y, m - 1, d))), value: w.signups };
                    })}
                  />
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-text-secondary">
                    {s.weekly.slice(-6).reverse().map((w) => (
                      <li key={w.week} className="flex justify-between gap-2">
                        <span>{w.week} haftası</span>
                        <span className="tabular-nums">
                          {w.signups} kayıt · {w.activated} aktive (%{pct(w.activated, w.signups)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card>
              <CardHeader title="Kayıt kaynakları" subtitle={`Son ${days} günde kayıt olan ${recent.length} kişi`} />
              {recent.length === 0 ? (
                <p className="text-sm text-text-muted">Bu dönemde kayıt yok.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="mb-2 text-xs font-bold text-text-muted">Geldiği sayfa</p>
                    <ShareBars rows={bySourcePage} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-text-muted">Kampanya (utm_source · utm_campaign)</p>
                    <ShareBars rows={byCampaign} />
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-text-muted">
                Reklam bağlantılarına ?utm_source=…&amp;utm_campaign=… eklersen kampanyalar burada ayrı görünür.
              </p>
            </Card>

            <Card>
              <CardHeader title="Özellik kullanımı" subtitle={`${s.adoption.books} aktif alanın kaçında kullanılıyor`} />
              <ul className="flex flex-col gap-3">
                {adoption.map((a) => (
                  <li key={a.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-secondary">{a.label}</span>
                      <span className="tabular-nums text-text-muted">
                        {a.value} · %{pct(a.value, s.adoption.books)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-balance" style={{ width: `${pct(a.value, s.adoption.books)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-text-muted">Toplam destek talebi: {s.adoption.tickets}</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
