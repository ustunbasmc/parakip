import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { displayNameOf, fetchAllRows, fmtDate, fmtRelative, getAuthUsers, isSubscriptionActive } from "@/lib/admin/data";
import { Avatar, Badge, EmptyState, ErrorBox, FilterTabs, PageHeader, Pagination, SearchForm, TableWrap, Td, Th } from "@/components/admin/ui";

const PAGE_SIZE = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["all", "active", "premium", "deletion", "deleted", "banned"] as const;
type Status = (typeof STATUSES)[number];

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  deletion_requested_at: string | null;
  deletion_completed_at: string | null;
  created_at: string;
};

async function loadProfiles(): Promise<{ rows: ProfileRow[]; error: { message: string } | null }> {
  try {
    const rows = await fetchAllRows<ProfileRow>((a, b) =>
      getAdminDbClient()
        .from("profiles")
        .select("user_id, display_name, first_name, last_name, phone, deletion_requested_at, deletion_completed_at, created_at")
        .order("user_id")
        .range(a, b)
    );
    return { rows, error: null };
  } catch (e) {
    return { rows: [], error: { message: (e as { message?: string })?.message ?? "Profiller okunamadı" } };
  }
}

/**
 * Kullanıcı listesi GİRİŞ HESAPLARINDAN (auth.users) kurulur ve profillerle
 * birleştirilir — profil satırı olmayan hesaplar da listede görünür.
 * Filtreleme/sıralama/sayfalama bellekte yapılır (getAuthUsers sınırı: 20.000).
 */
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
  const [authUsers, { rows: profilesAll, error: loadError }, { data: homeSubs }] = await Promise.all([
    getAuthUsers(),
    loadProfiles(),
    supabase.from("subscriptions").select("owner_user_id, status, current_period_end").eq("plan", "home_premium"),
  ]);
  const premiumIds = new Set((homeSubs ?? []).filter(isSubscriptionActive).map((s) => s.owner_user_id));
  const profileById = new Map(profilesAll.map((p) => [p.user_id, p]));

  const all = [...new Set([...authUsers.keys(), ...profileById.keys()])].map((id) => {
    const profile = profileById.get(id) ?? null;
    const auth = authUsers.get(id) ?? null;
    return { id, profile, auth, createdAt: auth?.createdAt ?? profile?.created_at ?? "" };
  });

  const needle = q.toLocaleLowerCase("tr-TR");
  const filtered = all
    .filter((u) => {
      if (!q) return true;
      if (UUID_RE.test(q)) return u.id.toLowerCase() === q.toLowerCase();
      const hay = [u.auth?.email, u.profile?.display_name, u.profile?.first_name, u.profile?.last_name, u.profile?.phone]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return hay.includes(needle);
    })
    .filter((u) => {
      switch (status) {
        case "active":
          return !u.profile?.deletion_requested_at && !u.auth?.bannedUntil;
        case "premium":
          return premiumIds.has(u.id);
        case "deletion":
          return Boolean(u.profile?.deletion_requested_at) && !u.profile?.deletion_completed_at;
        case "deleted":
          return Boolean(u.profile?.deletion_completed_at);
        case "banned":
          return Boolean(u.auth?.bannedUntil) && !u.profile?.deletion_completed_at;
        default:
          return true;
      }
    })
    .sort((a, b) => (sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));

  const from = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(from, from + PAGE_SIZE);
  const ids = rows.map((r) => r.id);
  const { data: owned } = ids.length
    ? await supabase.from("spaces").select("owner_user_id, type").in("owner_user_id", ids).eq("is_archived", false)
    : { data: [] as { owner_user_id: string; type: string }[] };
  const spaceCounts = new Map<string, { home: number; business: number }>();
  for (const sp of owned ?? []) {
    const c = spaceCounts.get(sp.owner_user_id) ?? { home: 0, business: 0 };
    if (sp.type === "home") c.home++;
    else c.business++;
    spaceCounts.set(sp.owner_user_id, c);
  }

  const total = filtered.length;
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

      {loadError ? (
        <ErrorBox message={`Kullanıcılar yüklenemedi: ${loadError.message}`} />
      ) : rows.length === 0 ? (
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
              {rows.map(({ id, profile: p, auth, createdAt }) => {
                const name = displayNameOf(p) ?? auth?.email ?? "Bilinmeyen kullanıcı";
                const sc = spaceCounts.get(id);
                return (
                  <tr key={id} className="transition-colors hover:bg-surface-muted/50">
                    <Td>
                      <Link href={`/admin/users/${id}`} className="flex min-w-0 items-center gap-3">
                        <Avatar name={name} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-text-primary">{name}</span>
                          <span className="block truncate text-xs text-text-muted">{auth?.email ?? p?.phone ?? "—"}{!p ? " · profil kaydı yok" : ""}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{premiumIds.has(id) ? <Badge tone="success">Ev Premium</Badge> : <Badge>Ücretsiz</Badge>}</Td>
                    <Td className="text-xs text-text-secondary">
                      {sc ? `${sc.home ? "Ev" : ""}${sc.home && sc.business ? " · " : ""}${sc.business ? `${sc.business} işletme` : ""}` : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtDate(createdAt)}</Td>
                    <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtRelative(auth?.lastSignInAt)}</Td>
                    <Td>
                      {p?.deletion_completed_at ? (
                        <Badge tone="danger">Silindi</Badge>
                      ) : p?.deletion_requested_at ? (
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
