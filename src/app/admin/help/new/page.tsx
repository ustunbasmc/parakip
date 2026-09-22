import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminArticleForm } from "@/components/admin/AdminArticleForm";

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminNewArticlePage() {
  const supabase = getAdminDbClient();
  const { data: categories } = await supabase.from("help_categories").select("id, title").order("sort_order");

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/admin/help" className="text-sm font-semibold text-accent">
        ← Tüm makaleler
      </Link>
      <h1 className="text-xl font-extrabold text-text-primary">Yeni makale</h1>
      <AdminArticleForm
        categories={categories ?? []}
        initial={{
          id: null,
          categoryId: "",
          slug: "",
          title: "",
          summary: "",
          body: "",
          steps: [],
          tags: [],
          relatedPath: "",
          relatedLabel: "",
          contextKeys: [],
          isFaq: false,
          sortOrder: 100,
          status: "draft",
        }}
      />
    </div>
  );
}
