import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { displayNameOf, fmtDate, isSubscriptionActive } from "@/lib/admin/data";
import { Badge, EmptyState, ErrorBox, FilterTabs, PageHeader, Pagination, SearchForm, TableWrap, Td, Th } from "@/components/admin/ui";

const PAGE_SIZE = 25;
const TYPES = ["all", "home", "business", "premium", "archived"] as const;
type Filter = (typeof TYPES)[number];

export default async function AdminSpacesPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const filter: Filter = (TYPES as readonly string[]).includes(params.type ?? "") ? (params.type as Filter) : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = getAdminDbClient();

  let premiumIds: string[] | null = null;
  if (filter === "premium") {
    const { data } = await supabase.from("subscriptions").select("space_id, status, current_period_end").eq("plan", "business");
    premiumIds = (data ?? []).filter(isSubscriptionActive).map((s) => s.space_id as string);
  }

  let query = supabase.from("spaces").select("id, name, type, sector, is_archived, owner_user_id, created_at", { count: "exact" });
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "")}%`);
  if (filter === "home" || filter === "business") query = query.eq("type", filter).eq("is_archived", false);
  if (filter === "archived") query = query.eq("is_archived", true);
  if (premiumIds !== null) {
    query = premiumIds.length ? query.in("id", premiumIds.slice(0, 500)) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: spaces, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const ids = (spaces ?? []).map((s) => s.id);
  const ownerIds = [...new Set((spaces ?? []).map((s) => s.owner_user_id))];
  const [{ data: owners }, { data: members }, { data: subs }] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", ownerIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] }),
    ids.length ? supabase.from("space_members").select("space_id").in("space_id", ids) : Promise.resolve({ data: [] as { space_id: string }[] }),
    ids.length
      ? supabase.from("subscriptions").select("space_id, status, current_period_end").eq("plan", "business").in("space_id", ids)
      : Promise.resolve({ data: [] as { space_id: string | null; status: string; current_period_end: string | null }[] }),
  ]);
  const ownerName = new Map((owners ?? []).map((o) => [o.user_id, displayNameOf(o) ?? "İsimsiz"]));
  const memberCount = new Map<string, number>();
  for (const m of members ?? []) memberCount.set(m.space_id, (memberCount.get(m.space_id) ?? 0) + 1);
  const premium = new Set((subs ?? []).filter(isSubscriptionActive).map((s) => s.space_id));

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: { type?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const t = over.type ?? filter;
    if (t !== "all") sp.set("type", t);
    const p = over.page ?? page;
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/spaces${s ? `?${s}` : ""}`;
  };

  const tabs: { value: Filter; label: string }[] = [
    { value: "all", label: "Tümü" },
    { value: "home", label: "Ev" },
    { value: "business", label: "İşletme" },
    { value: "premium", label: "İşletme Premium" },
    { value: "archived", label: "Arşivlenmiş" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Alanlar" description="Kullanıcıların Ev ve İşletme alanları. Ayrıntıda hesaplar, işlemler, üyeler ve abonelik yönetimi var." />
      <div className="flex flex-col gap-3">
        <SearchForm action="/admin/spaces" defaultValue={q} placeholder="Alan adı ara" hidden={{ type: filter === "all" ? "" : filter }} />
        <FilterTabs active={filter} items={tabs.map((t) => ({ value: t.value, label: t.label, href: href({ type: t.value, page: 1 }) }))} />
      </div>

      {error ? (
        <ErrorBox message={`Alanlar yüklenemedi: ${error.message}`} />
      ) : !spaces || spaces.length === 0 ? (
        <EmptyState title="Bu filtreye uyan alan yok." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Alan</Th>
                <Th>Tür</Th>
                <Th>Sahip</Th>
                <Th>Üye</Th>
                <Th>Plan</Th>
                <Th>Oluşturma</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {spaces.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-surface-muted/50">
                  <Td>
                    <Link href={`/admin/spaces/${s.id}`} className="block min-w-0">
                      <span className="block truncate font-semibold text-text-primary">{s.name}</span>
                      {s.sector ? <span className="block truncate text-xs text-text-muted">{s.sector}</span> : null}
                    </Link>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <Badge tone={s.type === "business" ? "accent" : "neutral"}>{s.type === "home" ? "Ev" : "İşletme"}</Badge>
                      {s.is_archived ? <Badge>Arşiv</Badge> : null}
                    </span>
                  </Td>
                  <Td>
                    <Link href={`/admin/users/${s.owner_user_id}`} className="text-sm text-text-secondary hover:text-accent">
                      {ownerName.get(s.owner_user_id) ?? "—"}
                    </Link>
                  </Td>
                  <Td className="tabular-nums text-text-secondary">{memberCount.get(s.id) ?? 0}</Td>
                  <Td>
                    {s.type === "business" ? (
                      premium.has(s.id) ? <Badge tone="success">Premium</Badge> : <Badge>Ücretsiz</Badge>
                    ) : (
                      <span className="text-xs text-text-muted">Sahip planı</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtDate(s.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(p) => href({ page: p })} />
        </>
      )}
    </div>
  );
}
