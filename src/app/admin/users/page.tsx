import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { displayNameOf, fmtDate, fmtRelative, getAuthUsers, isSubscriptionActive } from "@/lib/admin/data";
import { Avatar, Badge, EmptyState, ErrorBox, FilterTabs, PageHeader, Pagination, SearchForm, TableWrap, Td, Th } from "@/components/admin/ui";

const PAGE_SIZE = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["all", "active", "premium", "deletion", "deleted", "banned"] as const;
type Status = (typeof STATUSES)[number];

/** PostgREST `or` filtresi için güvenli arama terimi (virgül/parantez ayırıcıdır). */
function safeTerm(q: string) {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const status: Status = (STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as Status) : "all";
  const sort = params.sort === "oldest" ? "oldest" : "newest";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const supabase = getAdminDbClient();
  const authUsers = await getAuthUsers();

  // Filtrelerin kimlik kümeleri (e-posta, premium, askı auth/abonelik tarafında).
  let idFilter: string[] | null = null;
  const intersect = (ids: string[]) => {
    idFilter = idFilter === null ? ids : idFilter.filter((id) => ids.includes(id));
  };

  if (status === "premium") {
    const { data } = await supabase.from("subscriptions").select("owner_user_id, status, current_period_end").eq("plan", "home_premium");
    intersect((data ?? []).filter(isSubscriptionActive).map((s) => s.owner_user_id as string));
  }
  if (status === "banned") {
    intersect([...authUsers.values()].filter((u) => u.bannedUntil).map((u) => u.id));
  }

  let query = supabase
    .from("profiles")
    .select("user_id, display_name, first_name, last_name, phone, deletion_requested_at, deletion_completed_at, created_at", {
      count: "exact",
    });

  if (q) {
    if (UUID_RE.test(q)) {
      query = query.eq("user_id", q);
    } else {
      const term = safeTerm(q);
      const emailIds = [...authUsers.values()]
        .filter((u) => u.email?.toLocaleLowerCase("tr-TR").includes(q.toLocaleLowerCase("tr-TR")))
        .map((u) => u.id)
        .slice(0, 300);
      const ors = term
        ? [`display_name.ilike.*${term}*`, `first_name.ilike.*${term}*`, `last_name.ilike.*${term}*`, `phone.ilike.*${term}*`]
        : [];
      if (emailIds.length > 0) ors.push(`user_id.in.(${emailIds.join(",")})`);
      query = ors.length > 0 ? query.or(ors.join(",")) : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
    }
  }
  if (status === "active") query = query.is("deletion_requested_at", null);
  if (status === "deletion") query = query.not("deletion_requested_at", "is", null).is("deletion_completed_at", null);
  if (status === "deleted") query = query.not("deletion_completed_at", "is", null);
  if (idFilter !== null) {
    const ids = idFilter as string[];
    query = ids.length > 0 ? query.in("user_id", ids.slice(0, 500)) : query.eq("user_id", "00000000-0000-0000-0000-000000000000");
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: profiles, count, error } = await query
    .order("created_at", { ascending: sort === "oldest" })
    .range(from, from + PAGE_SIZE - 1);

  const ids = (profiles ?? []).map((p) => p.user_id);
  const [{ data: subs }, { data: owned }] = await Promise.all([
    ids.length
      ? supabase.from("subscriptions").select("owner_user_id, status, current_period_end").eq("plan", "home_premium").in("owner_user_id", ids)
      : Promise.resolve({ data: [] as { owner_user_id: string | null; status: string; current_period_end: string | null }[] }),
    ids.length
      ? supabase.from("spaces").select("owner_user_id, type").in("owner_user_id", ids).eq("is_archived", false)
      : Promise.resolve({ data: [] as { owner_user_id: string; type: string }[] }),
  ]);
  const premiumIds = new Set((subs ?? []).filter(isSubscriptionActive).map((s) => s.owner_user_id));
  const spaceCounts = new Map<string, { home: number; business: number }>();
  for (const s of owned ?? []) {
    const c = spaceCounts.get(s.owner_user_id) ?? { home: 0, business: 0 };
    if (s.type === "home") c.home++;
    else c.business++;
    spaceCounts.set(s.owner_user_id, c);
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (over: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, sort, page: String(page), ...over } as Record<string, string | number>;
    for (const [k, v] of Object.entries(merged)) {
      if (v === "" || (k === "status" && v === "all") || (k === "sort" && v === "newest") || (k === "page" && String(v) === "1")) continue;
      sp.set(k, String(v));
    }
    const s = sp.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  };

  const tabs: { value: Status; label: string }[] = [
    { value: "all", label: "Tümü" },
    { value: "active", label: "Aktif" },
    { value: "premium", label: "Ev Premium" },
    { value: "deletion", label: "Silme talebi" },
    { value: "deleted", label: "Silindi" },
    { value: "banned", label: "Askıda" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Kullanıcılar" description="Ad, soyad, telefon, e-posta veya kullanıcı kimliğiyle ara; duruma göre filtrele." />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchForm action="/admin/users" defaultValue={q} placeholder="Ad, e-posta, telefon veya ID" hidden={{ status: status === "all" ? "" : status }} />
          <div className="flex shrink-0 gap-1 text-xs font-semibold">
            <Link href={qs({ sort: "newest", page: 1 })} className={`rounded-lg px-3 py-2 ${sort === "newest" ? "bg-surface-muted text-text-primary" : "text-text-muted"}`}>
              En yeni
            </Link>
            <Link href={qs({ sort: "oldest", page: 1 })} className={`rounded-lg px-3 py-2 ${sort === "oldest" ? "bg-surface-muted text-text-primary" : "text-text-muted"}`}>
              En eski
            </Link>
          </div>
        </div>
        <FilterTabs active={status} items={tabs.map((t) => ({ value: t.value, label: t.label, href: qs({ status: t.value, page: 1 }) }))} />
      </div>

      {error ? (
        <ErrorBox message={`Kullanıcılar yüklenemedi: ${error.message}`} />
      ) : !profiles || profiles.length === 0 ? (
        <EmptyState title="Bu filtreye uyan kullanıcı yok." hint={q ? "Aramayı değiştirmeyi dene." : undefined} />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Kullanıcı</Th>
                <Th>Plan</Th>
                <Th>Alanlar</Th>
                <Th>Kayıt</Th>
                <Th>Son giriş</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {profiles.map((p) => {
                const auth = authUsers.get(p.user_id);
                const name = displayNameOf(p) ?? "İsimsiz";
                const sc = spaceCounts.get(p.user_id);
                return (
                  <tr key={p.user_id} className="transition-colors hover:bg-surface-muted/50">
                    <Td>
                      <Link href={`/admin/users/${p.user_id}`} className="flex min-w-0 items-center gap-3">
                        <Avatar name={name} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-text-primary">{name}</span>
                          <span className="block truncate text-xs text-text-muted">{auth?.email ?? p.phone ?? "—"}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{premiumIds.has(p.user_id) ? <Badge tone="success">Ev Premium</Badge> : <Badge>Ücretsiz</Badge>}</Td>
                    <Td className="text-xs text-text-secondary">
                      {sc ? `${sc.home ? "Ev" : ""}${sc.home && sc.business ? " · " : ""}${sc.business ? `${sc.business} işletme` : ""}` : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtDate(p.created_at)}</Td>
                    <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtRelative(auth?.lastSignInAt)}</Td>
                    <Td>
                      {p.deletion_completed_at ? (
                        <Badge tone="danger">Silindi</Badge>
                      ) : p.deletion_requested_at ? (
                        <Badge tone="warning">Silme talebi</Badge>
                      ) : auth?.bannedUntil ? (
                        <Badge tone="danger">Askıda</Badge>
                      ) : (
                        <Badge tone="accent">Aktif</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageCount={pageCount} total={total} hrefFor={(p) => qs({ page: p })} />
        </>
      )}
    </div>
  );
}
