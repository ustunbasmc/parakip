import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { fmtDateTime, resolveUserLabels, fmtRelative, PLAN_LABELS, requestNow } from "@/lib/admin/data";
import { formatCentsAsCurrency } from "@/lib/format/amount";
import { AdminPaymentActions } from "@/components/admin/AdminPaymentActions";
import { Badge, Card, EmptyState, ErrorBox, FilterTabs, PageHeader, StatCard } from "@/components/admin/ui";

const PERIOD_LABEL: Record<string, string> = { monthly: "Aylık", yearly: "Yıllık" };
const STATUSES = ["pending", "approved", "rejected", "all"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status: Status = (STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as Status) : "pending";
  const supabase = getAdminDbClient();

  // manual_payment_requests.user_id auth.users'a bağlıdır (profiles'a değil);
  // PostgREST ilişki çıkarımı çalışmadığından adlar ayrı sorguyla eşlenir.
  let query = supabase
    .from("manual_payment_requests")
    .select("id, user_id, plan, space_id, period, amount_cents, reference_code, status, user_note, admin_note, created_at, reviewed_at")
    .limit(200);
  if (status !== "all") query = query.eq("status", status);
  query = status === "pending" ? query.order("created_at", { ascending: true }) : query.order("created_at", { ascending: false });

  const since30 = new Date(requestNow() - 30 * 86_400_000).toISOString();
  const [{ data: requests, error }, pendingCount, { data: approved30 }, rejectedCount] = await Promise.all([
    query,
    supabase.from("manual_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("manual_payment_requests").select("amount_cents").eq("status", "approved").gte("reviewed_at", since30),
    supabase.from("manual_payment_requests").select("id", { count: "exact", head: true }).eq("status", "rejected").gte("reviewed_at", since30),
  ]);

  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const spaceIds = [...new Set((requests ?? []).map((r) => r.space_id))];
  const [nameByUserId, { data: spaces }] = await Promise.all([
    resolveUserLabels(userIds),
    spaceIds.length ? supabase.from("spaces").select("id, name").in("id", spaceIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  const approvedSum = (approved30 ?? []).reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Havale talepleri"
        description="Banka hesap hareketlerinde referans kodunu bulduktan sonra onayla. Onay, aboneliği anında aktifleştirir ve işlem kaydına yazılır."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Onay bekleyen" value={pendingCount.count ?? 0} tone={pendingCount.count ? "warning" : "default"} />
        <StatCard label="Onaylanan (30 gün)" value={formatCentsAsCurrency(approvedSum, "TRY")} hint={`${(approved30 ?? []).length} talep`} tone="success" />
        <StatCard label="Reddedilen (30 gün)" value={rejectedCount.count ?? 0} />
      </div>

      <FilterTabs
        active={status}
        items={[
          { value: "pending", label: "Bekleyen", href: "/admin/payments", count: pendingCount.count ?? 0 },
          { value: "approved", label: "Onaylanan", href: "/admin/payments?status=approved" },
          { value: "rejected", label: "Reddedilen", href: "/admin/payments?status=rejected" },
          { value: "all", label: "Tümü", href: "/admin/payments?status=all" },
        ]}
      />

      {error ? (
        <ErrorBox message={`Talepler yüklenemedi: ${error.message}`} />
      ) : !requests || requests.length === 0 ? (
        <EmptyState title={status === "pending" ? "Bekleyen talep yok." : "Kayıt yok."} />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold tabular-nums text-text-primary">{formatCentsAsCurrency(r.amount_cents, "TRY")}</span>
                    <Badge tone="accent">
                      {PLAN_LABELS[r.plan]} · {PERIOD_LABEL[r.period] ?? r.period}
                    </Badge>
                    {r.status === "approved" ? (
                      <Badge tone="success">Onaylandı</Badge>
                    ) : r.status === "rejected" ? (
                      <Badge tone="danger">Reddedildi</Badge>
                    ) : (
                      <Badge tone="warning">Bekliyor · {fmtRelative(r.created_at)}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="text-text-muted">Referans: </span>
                    <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-sm font-bold text-text-primary">{r.reference_code}</code>
                  </p>
                  <p className="mt-1.5 text-xs text-text-muted">
                    <Link href={`/admin/users/${r.user_id}`} className="font-semibold text-accent">
                      {nameByUserId.get(r.user_id) ?? "Kullanıcı"}
                    </Link>{" "}
                    ·{" "}
                    <Link href={`/admin/spaces/${r.space_id}`} className="hover:text-accent">
                      {spaceName.get(r.space_id) ?? "Alan"}
                    </Link>{" "}
                    · Bildirim: {fmtDateTime(r.created_at)}
                    {r.reviewed_at ? ` · İnceleme: ${fmtDateTime(r.reviewed_at)}` : ""}
                  </p>
                  {r.user_note ? <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-secondary">Kullanıcı notu: {r.user_note}</p> : null}
                  {r.admin_note ? <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">Red notu: {r.admin_note}</p> : null}
                </div>
                {r.status === "pending" ? (
                  <div className="shrink-0">
                    <AdminPaymentActions requestId={r.id} />
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
