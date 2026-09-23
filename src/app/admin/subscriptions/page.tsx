import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { displayNameOf, fmtDate, isSubscriptionActive, PLAN_LABELS, requestNow, SUB_STATUS_LABELS, subscriptionSource } from "@/lib/admin/data";
import { Badge, EmptyState, ErrorBox, FilterTabs, PageHeader, StatCard, TableWrap, Td, Th } from "@/components/admin/ui";

const FILTERS = ["active", "expiring", "expired", "all"] as const;
type Filter = (typeof FILTERS)[number];
const DAY = 86_400_000;

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; plan?: string }> }) {
  const params = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(params.filter ?? "") ? (params.filter as Filter) : "active";
  const plan = params.plan === "home_premium" || params.plan === "business" ? params.plan : "";
  const supabase = getAdminDbClient();

  const { data: rows, error } = await supabase
    .from("subscriptions")
    .select("id, plan, owner_user_id, space_id, status, current_period_end, metadata, updated_at")
    .order("current_period_end", { ascending: true, nullsFirst: false })
    .limit(1000);

  const now = requestNow();
  const all = rows ?? [];
  const isExpiring = (r: (typeof all)[number]) =>
    isSubscriptionActive(r) && r.current_period_end !== null && new Date(r.current_period_end).getTime() - now < 7 * DAY;
  const counts = {
    active: all.filter(isSubscriptionActive).length,
    expiring: all.filter(isExpiring).length,
    expired: all.filter((r) => !isSubscriptionActive(r)).length,
    all: all.length,
  };

  const visible = all
    .filter((r) => (plan ? r.plan === plan : true))
    .filter((r) =>
      filter === "active" ? isSubscriptionActive(r) : filter === "expiring" ? isExpiring(r) : filter === "expired" ? !isSubscriptionActive(r) : true
    );

  const ownerIds = [...new Set(visible.map((r) => r.owner_user_id).filter((x): x is string => Boolean(x)))];
  const spaceIds = [...new Set(visible.map((r) => r.space_id).filter((x): x is string => Boolean(x)))];
  const [{ data: owners }, { data: spaces }] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", ownerIds.slice(0, 500))
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] }),
    spaceIds.length
      ? supabase.from("spaces").select("id, name").in("id", spaceIds.slice(0, 500))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const ownerName = new Map((owners ?? []).map((o) => [o.user_id, displayNameOf(o) ?? "İsimsiz"]));
  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));

  const sources = new Map<string, number>();
  for (const r of all.filter(isSubscriptionActive)) {
    const s = subscriptionSource(r.metadata);
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }

  const href = (f: string, p = plan) => {
    const sp = new URLSearchParams();
    if (f !== "active") sp.set("filter", f);
    if (p) sp.set("plan", p);
    const s = sp.toString();
    return `/admin/subscriptions${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Abonelikler"
        description="Ev Premium sahip bazlı, İşletme Premium alan bazlıdır. Süreler otomatik yenilenmez; vermek/uzatmak için kullanıcı veya alan sayfasını kullan."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Aktif" value={counts.active} tone="success" />
        <StatCard label="7 gün içinde bitiyor" value={counts.expiring} tone={counts.expiring ? "warning" : "default"} />
        <StatCard label="Süresi dolmuş / iptal" value={counts.expired} />
        <StatCard
          label="Kaynak (aktif)"
          value={[...sources.values()].reduce((a, b) => a + b, 0)}
          hint={[...sources.entries()].map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <FilterTabs
            active={filter}
            items={[
              { value: "active", label: "Aktif", href: href("active"), count: counts.active },
              { value: "expiring", label: "Bitiyor", href: href("expiring"), count: counts.expiring },
              { value: "expired", label: "Dolmuş / iptal", href: href("expired"), count: counts.expired },
              { value: "all", label: "Tümü", href: href("all"), count: counts.all },
            ]}
          />
        </div>
        <div className="flex shrink-0 gap-1 text-xs font-semibold">
          {[
            ["", "Tüm planlar"],
            ["home_premium", "Ev"],
            ["business", "İşletme"],
          ].map(([v, l]) => (
            <Link key={v} href={href(filter, v)} className={`rounded-lg px-3 py-2 ${plan === v ? "bg-surface-muted text-text-primary" : "text-text-muted"}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorBox message={`Abonelikler yüklenemedi: ${error.message}`} />
      ) : visible.length === 0 ? (
        <EmptyState title="Bu filtreye uyan abonelik yok." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th>Sahip / Alan</Th>
              <Th>Durum</Th>
              <Th>Kaynak</Th>
              <Th>Bitiş</Th>
              <Th>Güncelleme</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((r) => {
              const active = isSubscriptionActive(r);
              const end = r.current_period_end ? new Date(r.current_period_end).getTime() : null;
              const daysLeft = end ? Math.ceil((end - now) / DAY) : null;
              const target =
                r.plan === "home_premium" && r.owner_user_id
                  ? { href: `/admin/users/${r.owner_user_id}`, label: ownerName.get(r.owner_user_id) ?? "Kullanıcı" }
                  : r.space_id
                    ? { href: `/admin/spaces/${r.space_id}`, label: spaceName.get(r.space_id) ?? "Alan" }
                    : null;
              return (
                <tr key={r.id} className="transition-colors hover:bg-surface-muted/50">
                  <Td>
                    <Badge tone={r.plan === "business" ? "accent" : "neutral"}>{PLAN_LABELS[r.plan] ?? r.plan}</Badge>
                  </Td>
                  <Td>
                    {target ? (
                      <Link href={target.href} className="font-semibold text-text-primary hover:text-accent">
                        {target.label}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {active ? (
                      <Badge tone={daysLeft !== null && daysLeft <= 7 ? "warning" : "success"}>Aktif</Badge>
                    ) : r.status === "active" ? (
                      <Badge tone="danger">Süresi doldu</Badge>
                    ) : (
                      <Badge>{SUB_STATUS_LABELS[r.status] ?? r.status}</Badge>
                    )}
                  </Td>
                  <Td className="text-xs text-text-secondary">{subscriptionSource(r.metadata)}</Td>
                  <Td className="whitespace-nowrap text-xs text-text-secondary">
                    {fmtDate(r.current_period_end)}
                    {active && daysLeft !== null ? <span className="text-text-muted"> · {daysLeft} gün</span> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-text-muted">{fmtDate(r.updated_at)}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
