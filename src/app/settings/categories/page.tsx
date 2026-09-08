import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { SpaceSwitcher } from "@/components/dashboard/SpaceSwitcher";
import { CategoryManagementView } from "@/components/settings/CategoryManagementView";
import { getUserSpacesBasic, resolveActiveSpace, getUserRoleForBook } from "@/lib/dashboard/formData";

export interface ManagedCategoryRow {
  id: string;
  name: string;
  kind: "income" | "expense";
  isCustom: boolean;
}

export default async function CategoriesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const spaces = await getUserSpacesBasic(supabase);
  if (spaces.length === 0) redirect("/onboarding/space-type");

  const params = await searchParams;
  const activeSpace = resolveActiveSpace(spaces, params.space);
  if (params.space && params.space !== activeSpace.id) {
    redirect(`/settings/categories?space=${activeSpace.id}`);
  }

  const role = await getUserRoleForBook(supabase, activeSpace.bookId);
  const canManage = role === "owner" || role === "admin" || role === "editor";

  // Hem sistem (book_id NULL) hem deftere özel, YALNIZCA AKTİF kategoriler.
  // Pasif (silinmiş/yeniden atanmış) kategoriler burada gösterilmez —
  // geçmiş işlemlerde isimleri zaten korunmaya devam eder, yalnızca
  // YÖNETİM listesinden kalkarlar.
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, is_custom, book_id")
    .eq("is_active", true)
    .or(`book_id.is.null,book_id.eq.${activeSpace.bookId}`)
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  const categories: ManagedCategoryRow[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind as "income" | "expense",
    isCustom: c.is_custom,
  }));

  return (
    <AppShell
      variant="subpage"
      title="Kategoriler"
      backFallbackHref={`/settings/spaces?space=${activeSpace.id}`}
      headerEnd={
        <SpaceSwitcher options={spaces.map((s) => ({ id: s.id, type: s.type, name: s.name }))} activeId={activeSpace.id} />
      }
    >
      {error ? (
        <p className="pt-6 text-center text-sm text-danger">Kategoriler yüklenemedi. Lütfen tekrar dene.</p>
      ) : (
        <CategoryManagementView bookId={activeSpace.bookId} categories={categories} canManage={canManage} />
      )}
    </AppShell>
  );
}
