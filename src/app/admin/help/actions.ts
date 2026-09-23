"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";

/**
 * Yardım makalesi yönetimi. HER action kendi İÇİNDE admin doğrulaması
 * yapar (Server Action'lar admin layout'undan geçmez).
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) throw new Error("Yetkisiz.");
  return user;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH_RE = /^\/[A-Za-z0-9/_?=&-]*$/;
const STATUSES = ["draft", "published", "archived"] as const;
type ArticleStatus = (typeof STATUSES)[number];

export interface ArticleInput {
  id: string | null;
  categoryId: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  steps: string[];
  tags: string[];
  relatedPath: string;
  relatedLabel: string;
  contextKeys: string[];
  isFaq: boolean;
  sortOrder: number;
  status: string;
}

type Result = { ok: true; id: string } | { ok: false; error: string };

function cleanList(values: string[], maxItems: number, maxLen: number) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, maxItems).map((v) => v.slice(0, maxLen));
}

export async function saveHelpArticle(input: ArticleInput): Promise<Result> {
  const admin = await assertAdmin();
  const supabase = getAdminDbClient();

  const title = input.title.trim();
  const slug = input.slug.trim();
  const summary = input.summary.trim();
  const relatedPath = input.relatedPath.trim();
  const status = (STATUSES as readonly string[]).includes(input.status) ? (input.status as ArticleStatus) : "draft";

  if (input.id !== null && !UUID_RE.test(input.id)) return { ok: false, error: "Geçersiz makale." };
  if (!UUID_RE.test(input.categoryId)) return { ok: false, error: "Kategori seç." };
  if (!title || title.length > 140) return { ok: false, error: "Başlık 1-140 karakter olmalı." };
  if (!SLUG_RE.test(slug) || slug.length > 120) return { ok: false, error: "Slug yalnızca küçük harf, rakam ve tire içerebilir." };
  if (!summary || summary.length > 400) return { ok: false, error: "Özet 1-400 karakter olmalı." };
  if (input.body.length > 20000) return { ok: false, error: "İçerik çok uzun." };
  if (relatedPath && (!PATH_RE.test(relatedPath) || relatedPath.startsWith("//")))
    return { ok: false, error: "İlgili ekran yolu / ile başlayan uygulama içi bir yol olmalı." };

  const row = {
    category_id: input.categoryId,
    slug,
    title,
    summary,
    body: input.body.trim(),
    steps: cleanList(input.steps, 20, 400),
    tags: cleanList(input.tags, 20, 40),
    related_path: relatedPath || null,
    related_label: input.relatedLabel.trim().slice(0, 60) || null,
    context_keys: cleanList(input.contextKeys, 10, 40),
    is_faq: Boolean(input.isFaq),
    sort_order: Number.isFinite(input.sortOrder) ? Math.round(input.sortOrder) : 100,
    status,
    updated_by: admin.id,
  };

  let id = input.id;
  let previousStatus: string | null = null;

  if (id) {
    const { data: before } = await supabase.from("help_articles").select("status").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "Makale bulunamadı." };
    previousStatus = before.status;
    const { error } = await supabase.from("help_articles").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "Bu slug başka bir makalede kullanılıyor." : error.message };
  } else {
    const { data, error } = await supabase
      .from("help_articles")
      .insert({ ...row, created_by: admin.id })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.code === "23505" ? "Bu slug başka bir makalede kullanılıyor." : error.message };
    id = data.id;
  }

  const action =
    input.id === null
      ? "help_article_create"
      : previousStatus !== status
        ? status === "published"
          ? "help_article_publish"
          : status === "archived"
            ? "help_article_archive"
            : "help_article_unpublish"
        : "help_article_update";

  await logAdminAction({
    adminUserId: admin.id,
    action,
    entityType: "help_article",
    entityId: id!,
    detail: { slug, status, previousStatus },
  });

  revalidatePath("/admin/help");
  revalidatePath("/help", "layout");
  return { ok: true, id: id! };
}

export async function setHelpArticleStatus(id: string, status: string): Promise<Result> {
  const admin = await assertAdmin();
  if (!UUID_RE.test(id) || !(STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Geçersiz istek." };
  const supabase = getAdminDbClient();

  const { data: before } = await supabase.from("help_articles").select("status, slug").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "Makale bulunamadı." };
  if (before.status === status) return { ok: true, id };

  const { error } = await supabase.from("help_articles").update({ status, updated_by: admin.id }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    adminUserId: admin.id,
    action: status === "published" ? "help_article_publish" : status === "archived" ? "help_article_archive" : "help_article_unpublish",
    entityType: "help_article",
    entityId: id,
    detail: { slug: before.slug, from: before.status, to: status },
  });

  revalidatePath("/admin/help");
  revalidatePath("/help", "layout");
  return { ok: true, id };
}

export interface CategoryInput {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * Yardım kategorisi oluşturur/günceller. Kategori SİLİNMEZ (makaleler
 * ona bağlı); kullanıcıdan gizlemek için pasife alınır — pasif kategori
 * ve makaleleri Yardım Merkezi'nde listelenmez (bkz. 0061 politikaları).
 */
export async function saveHelpCategory(input: CategoryInput): Promise<Result> {
  const admin = await assertAdmin();
  const supabase = getAdminDbClient();

  const slug = input.slug.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  if (input.id !== null && !UUID_RE.test(input.id)) return { ok: false, error: "Geçersiz kategori." };
  if (!title || title.length > 80) return { ok: false, error: "Başlık 1-80 karakter olmalı." };
  if (!SLUG_RE.test(slug) || slug.length > 80) return { ok: false, error: "Slug yalnızca küçük harf, rakam ve tire içerebilir." };
  if (description.length > 240) return { ok: false, error: "Açıklama en fazla 240 karakter olabilir." };

  const row = {
    slug,
    title,
    description: description || null,
    sort_order: Number.isFinite(input.sortOrder) ? Math.round(input.sortOrder) : 100,
    is_active: Boolean(input.isActive),
  };

  let id = input.id;
  let before: { is_active: boolean } | null = null;
  if (id) {
    const { data } = await supabase.from("help_categories").select("is_active").eq("id", id).maybeSingle();
    if (!data) return { ok: false, error: "Kategori bulunamadı." };
    before = data;
    const { error } = await supabase.from("help_categories").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "Bu slug başka bir kategoride kullanılıyor." : error.message };
  } else {
    const { data, error } = await supabase.from("help_categories").insert(row).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "Bu slug başka bir kategoride kullanılıyor." : error.message };
    id = data.id;
  }

  await logAdminAction({
    adminUserId: admin.id,
    action:
      input.id === null
        ? "help_category_create"
        : before && before.is_active !== row.is_active
          ? row.is_active
            ? "help_category_activate"
            : "help_category_deactivate"
          : "help_category_update",
    entityType: "help_category",
    entityId: id!,
    detail: { slug, isActive: row.is_active },
  });

  revalidatePath("/admin/help/categories");
  revalidatePath("/admin/help");
  revalidatePath("/help", "layout");
  return { ok: true, id: id! };
}
