import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { ACTION_LABELS, displayNameOf, ENTITY_LABELS, fmtDateTime } from "@/lib/admin/data";
import { EmptyState, ErrorBox, PageHeader, Pagination, TableWrap, Td, Th } from "@/components/admin/ui";

const PAGE_SIZE = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Bağlantı verilebilen kayıt türleri için detay sayfası. */
function entityHref(type: string, id: string | null, detail: Record<string, unknown> | null): string | null {
  if (!id) return null;
  if (type === "profile" || type === "user") return `/admin/users/${id}`;
  if (type === "support_ticket") return `/admin/support/${id}`;
  if (type === "help_article") return `/admin/help/${id}`;
  if (type === "help_category") return "/admin/help/categories";
  if (type === "subscription" && typeof detail?.targetId === "string") {
    return detail.plan === "business" ? `/admin/spaces/${detail.targetId}` : `/admin/users/${detail.targetId}`;
  }
  if (type === "subscription") return "/admin/payments?status=all";
  return null;
}

function summarize(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (v === null || v === undefined || k === "targetId") continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${val.length > 40 ? `${val.slice(0, 40)}…` : val}`);
  }
  return parts.join(" · ");
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entity?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const action = params.action && params.action in ACTION_LABELS ? params.action : "";
  const entity = params.entity && params.entity in ENTITY_LABELS ? params.entity : "";
  const from = params.from && DATE_RE.test(params.from) ? params.from : "";
  const to = params.to && DATE_RE.test(params.to) ? params.to : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = getAdminDbClient();

  let query = supabase.from("platform_admin_audit_log").select("id, admin_user_id, action, entity_type, entity_id, detail, created_at", { count: "exact" });
  if (action) query = query.eq("action", action);
  if (entity) query = query.eq("entity_type", entity);
  if (from) query = query.gte("created_at", `${from}T00:00:00+03:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999+03:00`);
  const start = (page - 1) * PAGE_SIZE;
  const { data: rows, count, error } = await query.order("created_at", { ascending: false }).range(start, start + PAGE_SIZE - 1);

  const adminIds = [...new Set((rows ?? []).map((r) => r.admin_user_id).filter((x): x is string => Boolean(x)))];
  const { data: admins } = adminIds.length
    ? await supabase.from("profiles").select("user_id, display_name, first_name, last_name").in("user_id", adminIds)
    : { data: [] as { user_id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] };
  const adminName = new Map((admins ?? []).map((a) => [a.user_id, displayNameOf(a) ?? "Admin"]));

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (action) sp.set("action", action);
    if (entity) sp.set("entity", entity);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };
  const field = "h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="İşlem kaydı"
        description="Admin panelinden yapılan tüm değişiklikler (kim, ne zaman, ne yaptı). Panel bu kayda yalnızca yeni satır ekler; mevcut kayıtları değiştirmez."
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          İşlem
          <select name="action" defaultValue={action} className={field}>
            <option value="">Tümü</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Kayıt türü
          <select name="entity" defaultValue={entity} className={field}>
            <option value="">Tümü</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Başlangıç
          <input type="date" name="from" defaultValue={from} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Bitiş
          <input type="date" name="to" defaultValue={to} className={field} />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-accent px-4 text-sm font-bold text-text-on-accent">
          Filtrele
        </button>
        <Link href="/admin/audit" className="h-10 px-2 text-sm font-semibold leading-10 text-text-muted">
          Temizle
        </Link>
      </form>

      {error ? (
        <ErrorBox message={`Kayıtlar yüklenemedi: ${error.message}`} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="Bu filtreye uyan kayıt yok." />
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Zaman</Th>
                <Th>Admin</Th>
                <Th>İşlem</Th>
                <Th>Kayıt</Th>
                <Th>Ayrıntı</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const detail = (r.detail ?? null) as Record<string, unknown> | null;
                const href = entityHref(r.entity_type, r.entity_id, detail);
                return (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap text-xs text-text-secondary">{fmtDateTime(r.created_at)}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {r.admin_user_id ? (
                        <Link href={`/admin/users/${r.admin_user_id}`} className="text-text-secondary hover:text-accent">
                          {adminName.get(r.admin_user_id) ?? "Admin"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-semibold text-text-primary">{ACTION_LABELS[r.action] ?? r.action}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {href ? (
                        <Link href={href} className="font-semibold text-accent">
                          {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                        </Link>
                      ) : (
                        <span className="text-text-secondary">{ENTITY_LABELS[r.entity_type] ?? r.entity_type}</span>
                      )}
                    </Td>
                    <Td className="max-w-[24rem] truncate text-xs text-text-muted">{summarize(detail) || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <Pagination page={page} pageCount={pageCount} total={total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
