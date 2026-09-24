import { getAdminDbClient } from "@/lib/admin/auth";
import { fmtDateTime, fmtRelative, requestNow } from "@/lib/admin/data";
import { Badge, Card, CardHeader, PageHeader } from "@/components/admin/ui";
import { TestEmailButton } from "@/components/admin/TestEmailButton";
import { EMAIL_CATEGORY_ENABLED, EMAIL_CATEGORY_LABELS, type EmailCategory } from "@/lib/email/policy";

const HOUR = 3_600_000;

/**
 * Ortam değişkenleri — YALNIZCA ADLARI ve tanımlı olup olmadıkları
 * gösterilir; değerler asla sayfaya yazılmaz.
 */
const ENV_GROUPS: { title: string; vars: { name: string; purpose: string; required: boolean }[] }[] = [
  {
    title: "Temel",
    vars: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", purpose: "Supabase proje adresi", required: true },
      { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", purpose: "Supabase istemci anahtarı", required: true },
      { name: "SUPABASE_SERVICE_ROLE_KEY", purpose: "Admin paneli ve zamanlanmış görevler", required: true },
      { name: "NEXT_PUBLIC_SITE_URL", purpose: "E-posta ve ödeme dönüş bağlantıları", required: true },
    ],
  },
  {
    title: "Zamanlanmış görevler",
    vars: [
      { name: "CRON_SECRET", purpose: "Vercel Cron istek doğrulaması", required: true },
      { name: "ADMIN_SECRET", purpose: "Hesap silme görevini elle tetikleme (POST)", required: false },
      { name: "ACCOUNT_DELETION_GRACE_DAYS", purpose: "Silme bekleme süresi (varsayılan 7)", required: false },
    ],
  },
  {
    title: "Ödeme",
    vars: [
      { name: "SHOPIER_API_KEY", purpose: "Shopier kart ödemesi", required: false },
      { name: "SHOPIER_API_SECRET", purpose: "Shopier imza doğrulaması", required: false },
      { name: "BANK_IBAN", purpose: "Havale ekranındaki IBAN", required: false },
      { name: "BANK_ACCOUNT_HOLDER", purpose: "Havale alıcı adı", required: false },
      { name: "BANK_NAME", purpose: "Havale banka adı", required: false },
    ],
  },
  {
    title: "E-posta",
    vars: [
      { name: "RESEND_API_KEY", purpose: "Uygulama e-postaları (destek, davet, ödeme) — Resend", required: false },
      { name: "SUPPORT_EMAIL_FROM", purpose: 'Gönderen, ör. "Parakip <bildirim@parakip.com>"', required: false },
      { name: "SUPPORT_EMAIL", purpose: "Yeni destek taleplerinin bildirileceği ekip adresi", required: false },
    ],
  },
];

const CRONS = [
  { path: "/api/cron/update-market-prices", schedule: "Her gün 09:00 (TR)", purpose: "Döviz/kripto fiyatları + günlük portföy değeri" },
  { path: "/api/admin/complete-account-deletions", schedule: "Her gün 06:30 (TR)", purpose: "Bekleme süresi dolan hesap silmelerini tamamlar" },
  { path: "pg_cron: run-scheduled-notifications", schedule: "Her gün 09:00 (TR)", purpose: "Borç vadesi ve bütçe uyarı bildirimleri (veritabanında)" },
];

type Health = "ok" | "warn" | "bad" | "unknown";

function HealthBadge({ h }: { h: Health }) {
  return h === "ok" ? (
    <Badge tone="success">Çalışıyor</Badge>
  ) : h === "warn" ? (
    <Badge tone="warning">Gecikmiş</Badge>
  ) : h === "bad" ? (
    <Badge tone="danger">Sorun</Badge>
  ) : (
    <Badge>Veri yok</Badge>
  );
}

export default async function AdminSystemPage() {
  const supabase = getAdminDbClient();
  const now = requestNow();

  const [prices, snapshot, scheduledNotif, overdueDeletions, pendingDeletions] = await Promise.all([
    supabase.from("market_prices_cache").select("symbol, fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("portfolio_value_snapshots").select("snapshot_date, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("notifications")
      .select("created_at")
      .in("type", ["debt_due", "budget_80", "budget_exceeded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .not("deletion_requested_at", "is", null)
      .is("deletion_completed_at", null)
      .lt("deletion_requested_at", new Date(now - 8 * 24 * HOUR).toISOString()),
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .not("deletion_requested_at", "is", null)
      .is("deletion_completed_at", null),
  ]);

  const age = (iso: string | null | undefined) => (iso ? now - new Date(iso).getTime() : null);
  const priceAge = age(prices.data?.fetched_at);
  const snapAge = age(snapshot.data?.created_at);
  const health = (a: number | null): Health => (a === null ? "unknown" : a < 26 * HOUR ? "ok" : a < 50 * HOUR ? "warn" : "bad");

  const checks: { title: string; detail: string; h: Health }[] = [
    {
      title: "Piyasa fiyatı güncellemesi",
      detail: prices.data ? `Son güncelleme ${fmtDateTime(prices.data.fetched_at)} (${fmtRelative(prices.data.fetched_at, now)})` : "Henüz fiyat kaydı yok",
      h: health(priceAge),
    },
    {
      title: "Günlük portföy değeri",
      detail: snapshot.data ? `Son kayıt ${snapshot.data.snapshot_date} (${fmtRelative(snapshot.data.created_at, now)})` : "Henüz kayıt yok — ilk kayıt bir sonraki fiyat güncellemesinde oluşur",
      h: health(snapAge),
    },
    {
      title: "Zamanlanmış bildirimler",
      detail: scheduledNotif.data
        ? `Son borç/bütçe bildirimi ${fmtRelative(scheduledNotif.data.created_at, now)} oluşturuldu (bildirim yalnızca koşul oluştuğunda üretilir)`
        : "Henüz borç/bütçe bildirimi oluşmadı",
      h: scheduledNotif.data ? "ok" : "unknown",
    },
    {
      title: "Hesap silme tamamlama",
      detail:
        (overdueDeletions.count ?? 0) > 0
          ? `${overdueDeletions.count} talep bekleme süresini aştığı hâlde tamamlanmadı`
          : `${pendingDeletions.count ?? 0} talep bekleme süresinde; geciken yok`,
      h: (overdueDeletions.count ?? 0) > 0 ? "bad" : "ok",
    },
  ];

  const deployment = {
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "—",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "—",
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sistem durumu" description="Zamanlanmış görevlerin son çalışması, ortam yapılandırması ve dağıtım bilgisi." />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {checks.map((c) => (
          <Card key={c.title}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-text-primary">{c.title}</p>
                <p className="mt-1 text-sm text-text-muted">{c.detail}</p>
              </div>
              <HealthBadge h={c.h} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ortam değişkenleri" subtitle="Yalnızca tanımlı olup olmadıkları gösterilir; değerler gösterilmez." />
          <div className="flex flex-col gap-5">
            {ENV_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">{g.title}</p>
                <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {g.vars.map((v) => {
                    const set = Boolean(process.env[v.name]);
                    return (
                      <li key={v.name} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0">
                          <code className="block truncate font-mono text-xs font-semibold text-text-primary">{v.name}</code>
                          <span className="block truncate text-xs text-text-muted">{v.purpose}</span>
                        </span>
                        {set ? <Badge tone="success">Tanımlı</Badge> : v.required ? <Badge tone="danger">Eksik</Badge> : <Badge tone="warning">Tanımsız</Badge>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="E-posta testi"
              subtitle="Resend ayarlarını doğrular. Kayıt onayı ve şifre sıfırlama e-postaları ayrıca Supabase SMTP ayarına bağlıdır."
            />
            <TestEmailButton />
            <p className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-wide text-text-muted">Uygulama e-postaları</p>
            <ul className="flex flex-col gap-1.5">
              {(Object.keys(EMAIL_CATEGORY_LABELS) as EmailCategory[]).map((c) => (
                <li key={c} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-text-secondary">{EMAIL_CATEGORY_LABELS[c]}</span>
                  {EMAIL_CATEGORY_ENABLED[c] ? <Badge tone="success">Açık</Badge> : <Badge>Kapalı</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-text-muted">
              Kota için kapalı türler uygulama içi bildirimle iletilir. Açıp kapatmak: src/lib/email/policy.ts. Kayıt onayı ve şifre
              sıfırlama Supabase üzerinden her zaman gönderilir.
            </p>
          </Card>
          <Card>
            <CardHeader title="Dağıtım" />
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Ortam</dt>
                <dd className="font-semibold text-text-primary">{deployment.env}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-muted">Commit</dt>
                <dd className="font-mono text-text-primary">{deployment.commit}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Zamanlanmış görevler" />
            <ul className="flex flex-col gap-3">
              {CRONS.map((c) => (
                <li key={c.path} className="text-sm">
                  <p className="font-semibold text-text-primary">{c.schedule}</p>
                  <p className="text-xs text-text-muted">{c.purpose}</p>
                  <code className="mt-0.5 block truncate font-mono text-[11px] text-text-muted">{c.path}</code>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
