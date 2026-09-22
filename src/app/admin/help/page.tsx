import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";

const STATUS_LABELS: Record<string, string> = { draft: "Taslak", published: "Yayında", archived: "Arşiv" };
const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-muted text-text-secondary",
  published: "bg-success-soft text-success",
  archived: "bg-danger-soft text-danger",
};

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminHelpPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status && params.status in STATUS_LABELS ? params.status : "";
  const supabase = getAdminDbClient();

  let query = supabase
    .from("help_articles")
    .select("id, slug, title, status, is_faq, updated_at, help_categories(title)")
    .order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const [{ data: articles, error }, { data: feedback }] = await Promise.all([
    query,
    supabase.from("help_article_feedback").select("article_id, helpful"),
  ]);

  const stats = new Map<string, { yes: number; no: number }>();
  for (const f of feedback ?? []) {
    const s = stats.get(f.article_id) ?? { yes: 0, no: 0 };
    if (f.helpful) s.yes++;
    else s.no++;
    stats.set(f.article_id, s);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Yardım Makaleleri</h1>
          <p className="mt-1 text-sm text-text-muted">Yalnızca &ldquo;Yayında&rdquo; makaleler kullanıcılara görünür.</p>
        </div>
        <Link href="/admin/help/new" className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-text-on-accent">
          Yeni makale
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {[["", "Tümü"], ...Object.entries(STATUS_LABELS)].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/admin/help?status=${value}` : "/admin/help"}
            className={`rounded-full px-3 py-1 font-semibold ${status === value ? "bg-accent text-text-on-accent" : "bg-surface-muted text-text-secondary"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger">Yüklenemedi: {error.message}</p>
      ) : !articles || articles.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">Makale yok.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {articles.map((a) => {
            const cat = Array.isArray(a.help_categories) ? a.help_categories[0] : a.help_categories;
            const s = stats.get(a.id);
            return (
              <Link
                key={a.id}
                href={`/admin/help/${a.id}`}
                className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text-muted">
                    {cat?.title ?? "—"} · /{a.slug}
                    {a.is_faq ? " · SSS" : ""}
                  </p>
                  <p className="truncate text-sm font-semibold text-text-primary">{a.title}</p>
                </div>
                {s ? (
                  <span className="shrink-0 text-xs text-text-muted" title="Faydalı / faydasız geri bildirim">
                    👍 {s.yes} · 👎 {s.no}
                  </span>
                ) : null}
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[a.status] ?? ""}`}>
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
