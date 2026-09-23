import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminCategoryEditor, type AdminCategory } from "@/components/admin/AdminCategoryEditor";

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminHelpCategoriesPage() {
  const supabase = getAdminDbClient();
  const [{ data: categories, error }, { data: articles }] = await Promise.all([
    supabase
      .from("help_categories")
      .select("id, slug, title, description, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true }),
    supabase.from("help_articles").select("category_id, status"),
  ]);

  const counts = new Map<string, { total: number; published: number }>();
  for (const a of articles ?? []) {
    const c = counts.get(a.category_id) ?? { total: 0, published: 0 };
    c.total++;
    if (a.status === "published") c.published++;
    counts.set(a.category_id, c);
  }

  const rows: AdminCategory[] = (categories ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description ?? "",
    sortOrder: c.sort_order,
    isActive: c.is_active,
    articleCount: counts.get(c.id)?.total ?? 0,
    publishedCount: counts.get(c.id)?.published ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Yardım Kategorileri</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pasif kategoriler ve içindeki makaleler Yardım Merkezi&apos;nde görünmez. Kategoriler silinmez, pasife alınır.
          </p>
        </div>
        <Link href="/admin/help" className="text-sm font-semibold text-accent">
          Makalelere dön
        </Link>
      </div>

      {error ? (
        <p className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger">Yüklenemedi: {error.message}</p>
      ) : (
        <AdminCategoryEditor categories={rows} />
      )}
    </div>
  );
}
