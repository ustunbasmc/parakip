import { getAdminDbClient } from "@/lib/admin/auth";
import { fmtDateTime, fmtRelative, requestNow } from "@/lib/admin/data";
import { Badge, Card, EmptyState, ErrorBox, FilterTabs, PageHeader, StatCard } from "@/components/admin/ui";
import { ErrorResolveButton } from "@/components/admin/ErrorResolveButton";

const DAY = 86_400_000;

/**
 * Uygulama hataları (bkz. migration 0067, instrumentation.ts,
 * lib/errors/reportClient.ts). Aynı hata tek satırda gruplanır; çözüldü
 * işaretlenen hata tekrar olursa kendiliğinden yeniden açılır. 30 günden
 * eski kayıtlar günlük görevde silinir.
 */
export default async function AdminErrorsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const filter = params.filter === "resolved" || params.filter === "all" ? params.filter : "open";
  const supabase = getAdminDbClient();
  const now = requestNow();

  let query = supabase
    .from("app_error_events")
    .select("id, source, message, stack, path, context, digest, user_agent, last_user_id, occurrences, first_seen, last_seen, resolved_at")
    .order("last_seen", { ascending: false })
    .limit(200);
  if (filter === "open") query = query.is("resolved_at", null);
  if (filter === "resolved") query = query.not("resolved_at", "is", null);

  const [{ data: rows, error }, openCount, last24] = await Promise.all([
    query,
    supabase.from("app_error_events").select("id", { count: "exact", head: true }).is("resolved_at", null),
    supabase.from("app_error_events").select("occurrences").gte("last_seen", new Date(now - DAY).toISOString()),
  ]);
  const occ24 = (last24.data ?? []).reduce((s, r) => s + r.occurrences, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Hatalar"
        description="Kullanıcıların karşılaştığı tarayıcı ve sunucu hataları. Kişisel veri tutulmaz (yol sorgusuz, e-posta yok). Aynı hata tek satırda sayılır."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Açık hata türü" value={openCount.count ?? 0} tone={openCount.count ? "warning" : "success"} />
        <StatCard label="Son 24 saatte" value={(last24.data ?? []).length} hint={`${occ24} kez görüldü`} />
      </div>
      <FilterTabs
        active={filter}
        items={[
          { value: "open", label: "Açık", href: "/admin/errors", count: openCount.count ?? 0 },
          { value: "resolved", label: "Çözüldü", href: "/admin/errors?filter=resolved" },
          { value: "all", label: "Tümü", href: "/admin/errors?filter=all" },
        ]}
      />
      {error ? (
        <ErrorBox message={`Hatalar yüklenemedi: ${error.message}`} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title={filter === "open" ? "Açık hata yok 🎉" : "Kayıt yok."} hint="Yeni hatalar burada otomatik görünür." />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.source === "server" ? "danger" : "warning"}>{r.source === "server" ? "Sunucu" : "Tarayıcı"}</Badge>
                    <Badge>{r.occurrences} kez</Badge>
                    {r.resolved_at ? <Badge tone="success">Çözüldü</Badge> : null}
                    <span className="text-xs text-text-muted">Son: {fmtRelative(r.last_seen, now)}</span>
                  </div>
                  <p className="mt-2 break-words font-mono text-sm font-semibold text-text-primary">{r.message}</p>
                  <p className="mt-1 break-words text-xs text-text-muted">
                    {r.path ?? "—"}
                    {r.context ? ` · ${r.context}` : ""}
                    {r.digest ? ` · digest ${r.digest}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    İlk: {fmtDateTime(r.first_seen)} · Son: {fmtDateTime(r.last_seen)}
                    {r.last_user_id ? " · giriş yapmış kullanıcı" : ""}
                  </p>
                  {r.stack ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-text-secondary">Yığın izi</summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-surface-muted p-3 text-[11px] leading-relaxed text-text-secondary">{r.stack}</pre>
                    </details>
                  ) : null}
                  {r.user_agent ? <p className="mt-1 truncate text-[11px] text-text-muted">{r.user_agent}</p> : null}
                </div>
                <div className="shrink-0">
                  <ErrorResolveButton id={r.id} resolved={Boolean(r.resolved_at)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
