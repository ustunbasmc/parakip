import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { GUIDES } from "@/content/rehber";
import { absoluteUrl } from "@/lib/site";

/**
 * Yalnızca GERÇEKTEN herkese açık sayfalar: tanıtım ve iniş sayfaları,
 * rehberler, bütçe şablonu ve yayındaki yardım makaleleri (herkese açık
 * okuma izniyle, migration 0070). Uygulamanın oturum gerektiren kısmı
 * eklenmez. Saatte bir yenilenir; yeni yayınlanan makale kendiliğinden girer.
 */
export const revalidate = 3600;

async function helpArticles(): Promise<{ slug: string; updated_at: string | null }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("help_articles").select("slug, updated_at").eq("status", "published");
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/ev-butcesi"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/esnaf-gelir-gider"), lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/butce-sablonu"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl("/rehber"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/help"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];
  const guides: MetadataRoute.Sitemap = GUIDES.map((g) => ({
    url: absoluteUrl(`/rehber/${g.slug}`),
    lastModified: new Date(`${g.updated}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));
  const help: MetadataRoute.Sitemap = (await helpArticles()).map((a) => ({
    url: absoluteUrl(`/help/${a.slug}`),
    lastModified: a.updated_at ? new Date(a.updated_at) : now,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  return [...staticPages, ...guides, ...help];
}
