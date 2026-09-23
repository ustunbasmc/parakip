import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import {
  bucketByDay,
  displayNameOf,
  fetchAllRows,
  fmtRelative,
  isSubscriptionActive,
  PLAN_LABELS,
  ACTION_LABELS,
  ENTITY_LABELS,
  requestNow,
} from "@/lib/admin/data";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { Avatar, Badge, BarSeries, Card, CardHeader, PageHeader, ShareBars, StatCard } from "@/components/admin/ui";
import { AlertIcon, BuildingIcon, CreditCardIcon, MessageIcon, StarIcon, UsersIcon } from "@/components/icons";

const DAY = 86_400_000;
const shortDay = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return shortDay.format(new Date(Date.UTC(y, m - 1, d)));
}


export default async function AdminDashboardPage() {
  const supabase = getAdminDbClient();
  const now = requestNow();
  const since60 = new Date(now - 60 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [
    usersCount,
    spacesCount,
    businessCount,
    recentProfiles,
    recentTx,
    subs,
    pendingPayments,
    approved30,
    openTickets,
    deletions,
    latestUsers,
    audit,
  ] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase.from("spaces").select("id", { count: "exact", head: true }).eq("is_archived", false),
    supabase.from("spaces").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("type", "business"),
    fetchAllRows<{ created_at: string }>((a, b) =>
      supabase.from("profiles").select("created_at").gte("created_at", since60).order("created_at").range(a, b)
    ).catch(() => []),
    fetchAllRows<{ created_at: string }>((a, b) =>
      supabase.from("transactions").select("created_at").gte("created_at", since30).order("created_at").range(a, b)
    ).catch(() => []),
    supabase.from("subscriptions").select("plan, status, current_period_end"),
    supabase.from("manual_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("manual_payment_requests").select("amount_cents").eq("status", "approved").gte("reviewed_at", since30),
    supabase.from("support_tickets").select("id, status", { count: "exact" }).in("status", ["open", "in_review", "awaiting_user"]),
    supabase
      .from("profiles")
      .select("user_id, deletion_requested_at", { count: "exact" })
      .not("deletion_requested_at", "is", null)
      .is("deletion_completed_at", null),
    supabase
      .from("profiles")
      .select("user_id, display_name, first_name, last_name, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("platform_admin_audit_log").select("id, action, entity_type, entity_id, created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  // Kayıt trendi: son 30 gün + önceki 30 gün karşılaştırması.
  const signupTs = recentProfiles.map((r) => r.created_at);
  const signupBuckets = bucketByDay(signupTs, 30);
  const last7 = signupTs.filter((t) => now - new Date(t).getTime() < 7 * DAY).length;
  const prev7 = signupTs.filter((t) => {
    const age = now - new Date(t).getTime();
    return age >= 7 * DAY && age < 14 * DAY;
  }).length;
  const last30 = signupTs.filter((t) => now - new Date(t).getTime() < 30 * DAY).length;

  const txBuckets = bucketByDay(
    recentTx.map((r) => r.created_at),
    30
  );
  const tx30 = recentTx.length;

  const activeSubs = (subs.data ?? []).filter(isSubscriptionActive);
  const homePremium = activeSubs.filter((s) => s.plan === "home_premium").length;
  const businessPremium = activeSubs.filter((s) => s.plan === "business").length;
  const expiringSoon = activeSubs.filter(
    (s) => s.current_period_end && new Date(s.current_period_end).getTime() - now < 7 * DAY
  ).length;
  const approvedSum = (approved30.data ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const ticketsWaiting = (openTickets.data ?? []).filter((t) => t.status !== "awaiting_user").length;
  const overdueDeletions = (deletions.data ?? []).filter(
    (d) => d.deletion_requested_at && now - new Date(d.deletion_requested_at).getTime() > 8 * DAY
  ).length;

  const attention = [
    pendingPayments.count
      ? { href: "/admin/payments", text: `${pendingPayments.count} havale talebi onay bekliyor`, tone: "warning" as const }
      : null,
    ticketsWaiting ? { href: "/admin/support", text: `${ticketsWaiting} destek talebi yanıt bekliyor`, tone: "warning" as const } : null,
    expiringSoon
      ? { href: "/admin/subscriptions?filter=expiring", text: `${expiringSoon} aboneliğin süresi 7 gün içinde doluyor`, tone: "neutral" as const }
      : null,
    overdueDeletions
      ? {
          href: "/admin/users?status=deletion",
          text: `${overdueDeletions} silme talebi süresini geçti — otomatik tamamlama çalışmıyor olabilir`,
          tone: "danger" as const,
        }
      : null,
  ].filter((x): x is { href: string; text: string; tone: "warning" | "neutral" | "danger" } => x !== null);

  const totalUsers = usersCount.count ?? 0;
  const premiumShare = [
    { label: "Ev Premium (sahip)", value: homePremium, tone: "bg-accent" },
    { label: "Ücretsiz kullanıcı", value: Math.max(totalUsers - homePremium, 0), tone: "bg-border-strong" },
  ];
  const businessShare = [
    { label: "İşletme Premium", value: businessPremium, tone: "bg-balance" },
    { label: "Ücretsiz işletme", value: Math.max((businessCount.count ?? 0) - businessPremium, 0), tone: "bg-border-strong" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Genel bakış"
        description="Platformun anlık durumu. Bu panel service_role ile çalışır; yapılan her değişiklik işlem kaydına yazılır."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Kullanıcı" value={totalUsers} delta={last7 - prev7} hint={`son 7 gün: +${last7}`} href="/admin/users" icon={<UsersIcon size={15} />} />
        <StatCard label="Aktif alan" value={spacesCount.count ?? 0} hint={`${businessCount.count ?? 0} işletme`} href="/admin/spaces" icon={<BuildingIcon size={15} />} />
        <StatCard
          label="Premium"
          value={homePremium + businessPremium}
          hint={`${homePremium} Ev · ${businessPremium} İşletme`}
          href="/admin/subscriptions"
          tone="success"
          icon={<StarIcon size={15} />}
        />
        <StatCard
          label="Havale (30 gün)"
          value={formatCentsAsCurrency(approvedSum, "TRY")}
          hint="onaylanan tutar"
          href="/admin/payments?status=approved"
          icon={<CreditCardIcon size={15} />}
        />
        <StatCard
          label="Bekleyen havale"
          value={pendingPayments.count ?? 0}
          href="/admin/payments"
          tone={pendingPayments.count ? "warning" : "default"}
          icon={<CreditCardIcon size={15} />}
        />
        <StatCard
          label="Açık destek"
          value={openTickets.count ?? 0}
          hint={`${ticketsWaiting} yanıt bekliyor`}
          href="/admin/support"
          tone={ticketsWaiting ? "warning" : "default"}
          icon={<MessageIcon size={15} />}
        />
      </div>

      {attention.length > 0 ? (
        <Card>
          <CardHeader title="İlgilenmen gerekenler" />
          <ul className="flex flex-col gap-2">
            {attention.map((a) => (
              <li key={a.href + a.text}>
                <Link
                  href={a.href}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      a.tone === "danger" ? "bg-danger-soft text-danger" : a.tone === "warning" ? "bg-warning-soft text-warning" : "bg-surface-muted text-text-secondary"
                    }`}
                  >
                    <AlertIcon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-text-primary">{a.text}</span>
                  <span className="text-text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Yeni kayıtlar" subtitle={`Son 30 gün: ${last30} kullanıcı`} />
          <BarSeries label="Günlük yeni kayıt" data={signupBuckets.map((b) => ({ key: b.date, label: dayLabel(b.date), value: b.count }))} />
        </Card>
        <Card>
          <CardHeader title="İşlem hacmi" subtitle={`Son 30 gün: ${tx30.toLocaleString("tr-TR")} işlem (gelir, gider, transfer)`} />
          <BarSeries label="Günlük işlem" data={txBuckets.map((b) => ({ key: b.date, label: dayLabel(b.date), value: b.count }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Plan dağılımı" subtitle="Aktif abonelikler" />
          <div className="flex flex-col gap-5">
            <ShareBars rows={premiumShare} />
            <ShareBars rows={businessShare} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Son kayıt olanlar"
            action={
              <Link href="/admin/users" className="text-xs font-semibold text-accent">
                Tümü
              </Link>
            }
          />
          <ul className="flex flex-col gap-1">
            {(latestUsers.data ?? []).map((u) => {
              const name = displayNameOf(u) ?? "İsimsiz";
              return (
                <li key={u.user_id}>
                  <Link href={`/admin/users/${u.user_id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted">
                    <Avatar name={name} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{name}</span>
                    <span className="shrink-0 text-xs text-text-muted">{fmtRelative(u.created_at, now)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Son admin işlemleri"
            action={
              <Link href="/admin/audit" className="text-xs font-semibold text-accent">
                Tümü
              </Link>
            }
          />
          {(audit.data ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">Henüz kayıt yok.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {(audit.data ?? []).map((a) => (
                <li key={a.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{ACTION_LABELS[a.action] ?? a.action}</p>
                    <p className="truncate text-xs text-text-muted">
                      {ENTITY_LABELS[a.entity_type] ?? a.entity_type} · {fmtRelative(a.created_at, now)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-text-muted">
        Not: Shopier ödemelerinin tutarı veritabanında saklanmadığı için gelir kartı yalnızca onaylanan havale tutarını gösterir.
        Aktif abonelik sayıları her iki kaynağı da kapsar. {Object.values(PLAN_LABELS).join(" / ")} süreleri otomatik yenilenmez.
      </p>
      {deletions.count ? (
        <p className="text-xs text-text-muted">
          <Badge tone="warning">{deletions.count}</Badge> hesap silme talebi 7 günlük bekleme süresinde.
        </p>
      ) : null}
    </div>
  );
}
