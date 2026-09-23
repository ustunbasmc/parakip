import Link from "next/link";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminArticleForm } from "@/components/admin/AdminArticleForm";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminEditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = getAdminDbClient();
  const [{ data: article }, { data: categories }] = await Promise.all([
    supabase
      .from("help_articles")
      .select("id, category_id, slug, title, summary, body, steps, tags, related_path, related_label, context_keys, is_faq, sort_order, status")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("help_categories").select("id, title").order("sort_order"),
  ]);
  if (!article) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdminBackLink href="/admin/help" label="Tüm makaleler" />
        {article.status === "published" ? (
          <Link href={`/help/${article.slug}`} className="text-sm font-semibold text-accent">
            Uygulamada görüntüle →
          </Link>
        ) : null}
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Makaleyi düzenle</h1>
      <AdminArticleForm
        key={article.id}
        categories={categories ?? []}
        initial={{
          id: article.id,
          categoryId: article.category_id,
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          body: article.body,
          steps: Array.isArray(article.steps) ? article.steps.filter((s: unknown): s is string => typeof s === "string") : [],
          tags: article.tags ?? [],
          relatedPath: article.related_path ?? "",
          relatedLabel: article.related_label ?? "",
          contextKeys: article.context_keys ?? [],
          isFaq: article.is_faq,
          sortOrder: article.sort_order,
          status: article.status,
        }}
      />
    </div>
  );
}
