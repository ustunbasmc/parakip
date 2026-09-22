import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Yardım Merkezi okuma yardımcıları — RLS'e tabi normal client ile
 * çalışır. RLS yalnızca status='published' makaleleri ve aktif
 * kategorileri döndürür; burada ayrıca `status` filtresi de uygulanır
 * (savunma derinliği — RLS yanlışlıkla gevşetilse bile taslak sızmasın).
 */

export interface HelpCategory {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  articleCount: number;
}

export interface HelpArticleListItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  categorySlug?: string;
  categoryTitle?: string;
}

export interface HelpArticle extends HelpArticleListItem {
  body: string;
  steps: string[];
  tags: string[];
  relatedPath: string | null;
  relatedLabel: string | null;
  categoryId: string;
}

export async function getHelpCategories(supabase: SupabaseClient): Promise<HelpCategory[]> {
  const [{ data: categories, error }, { data: articles }] = await Promise.all([
    supabase.from("help_categories").select("id, slug, title, description").eq("is_active", true).order("sort_order"),
    supabase.from("help_articles").select("category_id").eq("status", "published"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const a of articles ?? []) counts.set(a.category_id, (counts.get(a.category_id) ?? 0) + 1);

  return (categories ?? []).map((c) => ({ ...c, articleCount: counts.get(c.id) ?? 0 }));
}

export async function getFaqArticles(supabase: SupabaseClient): Promise<HelpArticleListItem[]> {
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, slug, title, summary")
    .eq("status", "published")
    .eq("is_faq", true)
    .order("sort_order")
    .limit(8);
  if (error) throw error;
  return data ?? [];
}

export async function getCategoryWithArticles(
  supabase: SupabaseClient,
  slug: string
): Promise<{ category: HelpCategory; articles: HelpArticleListItem[] } | null> {
  const { data: category } = await supabase
    .from("help_categories")
    .select("id, slug, title, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (!category) return null;

  const { data: articles, error } = await supabase
    .from("help_articles")
    .select("id, slug, title, summary")
    .eq("category_id", category.id)
    .eq("status", "published")
    .order("sort_order")
    .order("title");
  if (error) throw error;

  return { category: { ...category, articleCount: articles?.length ?? 0 }, articles: articles ?? [] };
}

export async function searchHelpArticles(supabase: SupabaseClient, query: string): Promise<HelpArticleListItem[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const { data, error } = await supabase.rpc("search_help_articles", { p_query: q, p_limit: 20 });
  if (error) throw error;
  return (data ?? []).map((r: { id: string; slug: string; title: string; summary: string; category_slug: string; category_title: string }) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    categorySlug: r.category_slug,
    categoryTitle: r.category_title,
  }));
}

export async function getHelpArticle(supabase: SupabaseClient, slug: string): Promise<HelpArticle | null> {
  const { data } = await supabase
    .from("help_articles")
    .select("id, slug, title, summary, body, steps, tags, related_path, related_label, category_id, help_categories(slug, title)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;

  const category = Array.isArray(data.help_categories) ? data.help_categories[0] : data.help_categories;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    summary: data.summary,
    body: data.body,
    steps: Array.isArray(data.steps) ? data.steps.filter((s: unknown): s is string => typeof s === "string") : [],
    tags: data.tags ?? [],
    relatedPath: data.related_path,
    relatedLabel: data.related_label,
    categoryId: data.category_id,
    categorySlug: category?.slug,
    categoryTitle: category?.title,
  };
}

export async function getRelatedArticles(
  supabase: SupabaseClient,
  categoryId: string,
  excludeId: string
): Promise<HelpArticleListItem[]> {
  const { data } = await supabase
    .from("help_articles")
    .select("id, slug, title, summary")
    .eq("category_id", categoryId)
    .eq("status", "published")
    .neq("id", excludeId)
    .order("sort_order")
    .limit(4);
  return data ?? [];
}

/** Kullanıcının bu makaleye daha önce verdiği geri bildirim (yoksa null). */
export async function getMyArticleFeedback(
  supabase: SupabaseClient,
  articleId: string,
  userId: string
): Promise<boolean | null> {
  const { data } = await supabase
    .from("help_article_feedback")
    .select("helpful")
    .eq("article_id", articleId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? data.helpful : null;
}

/** Yalnızca uygulama içi yollar — dış bağlantıya yönlendirme yapılmaz. */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}
