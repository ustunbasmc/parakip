import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import {
  ACTION_LABELS,
  displayNameOf,
  fmtDate,
  fmtDateTime,
  fmtRelative,
  getAuthUser,
  isSubscriptionActive,
  PLAN_LABELS,
  ROLE_LABELS,
  SUB_STATUS_LABELS,
  subscriptionSource,
} from "@/lib/admin/data";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { formatTicketNumber } from "@/lib/support/constants";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminUserEditForm } from "@/components/admin/AdminUserEditForm";
import { SubscriptionManager } from "@/components/admin/SubscriptionManager";
import { UserBanControl } from "@/components/admin/UserBanControl";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { Avatar, Badge, Card, CardHeader, KeyValue, PageHeader } from "@/components/admin/ui";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAYMENT_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Bekliyor", tone: "warning" },
  approved: { label: "Onaylandı", tone: "success" },
  rejected: { label: "Reddedildi", tone: "danger" },
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = getAdminDbClient();

  const [{ data: profile }, auth, { data: isAdminTarget }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, first_name, last_name, phone, deletion_requested_at, deletion_completed_at, created_at")
      .eq("user_id", id)
      .maybeSingle(),
    getAuthUser(id),
    supabase.rpc("is_platform_admin", { p_user_id: id }),
  ]);
  if (!profile && !auth) notFound();

  const [{ data: memberships }, { data: homeSub }, { data: payments }, { data: tickets }, { data: audit }] = await Promise.all([
    supabase.from("space_members").select("role, spaces(id, name, type, is_archived, owner_user_id, created_at)").eq("user_id", id),
    supabase
      .from("subscriptions")
      .select("id, status, current_period_end, metadata, updated_at")
      .eq("plan", "home_premium")
      .eq("owner_user_id", id)
      .maybeSingle(),
    supabase
      .from("manual_payment_requests")
      .select("id, plan, period, amount_cents, reference_code, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("platform_admin_audit_log")
      .select("id, action, created_at, detail")
      .or(`entity_id.eq.${id},detail->>targetId.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const spaces = (memberships ?? [])
    .map((m) => ({ role: m.role as string, space: Array.isArray(m.spaces) ? m.spaces[0] : m.spaces }))
    .filter((m): m is { role: string; space: NonNullable<typeof m.space> } => Boolean(m.space));
  const businessIds = spaces.filter((s) => s.space.type === "business").map((s) => s.space.id);
  const { data: businessSubs } = businessIds.length
    ? await supabase.from("subscriptions").select("space_id, status, current_period_end").eq("plan", "business").in("space_id", businessIds)
    : { data: [] as { space_id: string | null; status: string; current_period_end: string | null }[] };
  const premiumSpaces = new Set((businessSubs ?? []).filter(isSubscriptionActive).map((s) => s.space_id));

  const name = displayNameOf(profile) ?? auth?.email ?? "Bilinmeyen kullanıcı";
  const homeActive = homeSub ? isSubscriptionActive(homeSub) : false;
  const deleted = Boolean(profile?.deletion_completed_at);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<AdminBackLink href="/admin/users" label="Kullanıcılar" />}
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {deleted ? (
              <Badge tone="danger">Silindi</Badge>
            ) : profile?.deletion_requested_at ? (
              <Badge tone="warning">Silme talebi · {fmtDate(profile?.deletion_requested_at)}</Badge>
            ) : auth && !auth.emailConfirmedAt ? (
              <Badge tone="warning">E-posta onaylanmadı · hiç giriş yapamadı</Badge>
            ) : auth?.bannedUntil ? (
              <Badge tone="danger">Askıda</Badge>
            ) : (
              <Badge tone="accent">Aktif</Badge>
            )}
            {homeActive ? <Badge tone="success">Ev Premium</Badge> : <Badge>Ücretsiz</Badge>}
            {isAdminTarget ? <Badge tone="warning">Platform admin</Badge> : null}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={name} size={48} />
              <div className="min-w-0">
                <p className="truncate font-bold text-text-primary">{auth?.email ?? "E-posta yok"}</p>
                <p className="truncate font-mono text-[11px] text-text-muted">{id}</p>
              </div>
            </div>
            <KeyValue
              items={[
                { label: "Kayıt tarihi", value: fmtDateTime(auth?.createdAt ?? profile?.created_at) },
                { label: "Son giriş", value: auth?.lastSignInAt ? `${fmtDateTime(auth.lastSignInAt)} (${fmtRelative(auth.lastSignInAt)})` : "—" },
                { label: "E-posta doğrulama", value: auth?.emailConfirmedAt ? `Doğrulandı · ${fmtDate(auth.emailConfirmedAt)}` : "Doğrulanmadı" },
                { label: "Giriş yöntemi", value: auth?.providers.length ? auth.providers.join(", ") : "—" },
                { label: "Telefon", value: profile?.phone || "—" },
                { label: "Askı", value: auth?.bannedUntil ? `Askıda (${fmtDate(auth.bannedUntil)} tarihine kadar)` : "Yok" },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Alanlar" subtitle={`${spaces.length} alan (sahip veya üye)`} />
            {spaces.length === 0 ? (
              <p className="text-sm text-text-muted">Hiçbir alana üye değil.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {spaces.map(({ role, space }) => (
                  <li key={space.id}>
                    <Link href={`/admin/spaces/${space.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">{space.name}</span>
                        <span className="block text-xs text-text-muted">
                          {space.type === "home" ? "Ev" : "İşletme"} · {ROLE_LABELS[role] ?? role} · {fmtDate(space.created_at)}
                        </span>
                      </span>
                      {space.is_archived ? <Badge>Arşiv</Badge> : null}
                      {space.type === "business" ? (
                        premiumSpaces.has(space.id) ? <Badge tone="success">Premium</Badge> : <Badge>Ücretsiz</Badge>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Havale talepleri" />
              {(payments ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">Talep yok.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(payments ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-text-primary">
                          {PLAN_LABELS[p.plan]} · {formatCentsAsCurrency(p.amount_cents, "TRY")}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {p.reference_code} · {fmtDate(p.created_at)}
                        </span>
                      </span>
                      <Badge tone={PAYMENT_STATUS[p.status]?.tone}>{PAYMENT_STATUS[p.status]?.label ?? p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Destek talepleri" />
              {(tickets ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">Talep yok.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(tickets ?? []).map((t) => (
                    <li key={t.id}>
                      <Link href={`/admin/support/${t.id}`} className="flex items-center justify-between gap-2 text-sm hover:opacity-80">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-text-primary">{t.subject}</span>
                          <span className="block text-xs text-text-muted">
                            {formatTicketNumber(t.ticket_number)} · {fmtDate(t.created_at)}
                          </span>
                        </span>
                        <TicketStatusBadge status={t.status} admin />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="Ev Premium"
              subtitle={
                homeSub
                  ? `${SUB_STATUS_LABELS[homeSub.status] ?? homeSub.status} · ${subscriptionSource(homeSub.metadata)}${
                      homeSub.current_period_end ? ` · bitiş ${fmtDate(homeSub.current_period_end)}` : ""
                    }`
                  : "Abonelik kaydı yok"
              }
              action={homeActive ? <Badge tone="success">Aktif</Badge> : <Badge>Pasif</Badge>}
            />
            {deleted ? (
              <p className="text-xs text-text-muted">Silinmiş hesaba abonelik verilemez.</p>
            ) : (
              <SubscriptionManager plan="home_premium" targetId={id} active={homeActive} compact />
            )}
            <p className="mt-3 text-[11px] text-text-muted">
              İşletme Premium, ilgili işletme alanının sayfasından yönetilir.
            </p>
          </Card>

          {!deleted ? (
            <Card>
              <CardHeader title="Profili düzenle" />
              <AdminUserEditForm userId={id} firstName={profile?.first_name ?? null} lastName={profile?.last_name ?? null} phone={profile?.phone ?? null} />
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Hesap erişimi" subtitle="Askıya alınan kullanıcı giriş yapamaz; verileri korunur." />
            <UserBanControl
              userId={id}
              banned={Boolean(auth?.bannedUntil)}
              disabledReason={
                deleted
                  ? "Hesap silme işlemi tamamlanmış; hesap kalıcı olarak kapalı."
                  : isAdminTarget
                    ? "Platform admin hesapları askıya alınamaz."
                    : null
              }
            />
          </Card>

          <Card>
            <CardHeader title="Admin işlem geçmişi" />
            {(audit ?? []).length === 0 ? (
              <p className="text-sm text-text-muted">Bu kullanıcıyla ilgili admin işlemi yok.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {(audit ?? []).map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-medium text-text-primary">{ACTION_LABELS[a.action] ?? a.action}</p>
                    <p className="text-xs text-text-muted">{fmtDateTime(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
