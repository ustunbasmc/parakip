import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { HelpSearchBox } from "@/components/help/HelpSearchBox";
import { ArticleListItem, ChevronRightIcon } from "@/components/help/ArticleListItem";
import { AlertIcon, InboxIcon, SparkleIcon, HelpCircleIcon } from "@/components/icons";
import {
  getCategoryWithArticles,
  getFaqArticles,
  getHelpCategories,
  searchHelpArticles,
  type HelpArticleListItem,
  type HelpCategory,
} from "@/lib/help/queries";

export const metadata = { title: "Yardım Merkezi | Parakip" };

const SHORTCUTS = [
  { href: "/support/new", label: "Sorunumu çözemiyorum", Icon: HelpCircleIcon, tint: "bg-accent-soft text-accent" },
  { href: "/support/new?type=bug", label: "Hata bildir", Icon: AlertIcon, tint: "bg-danger-soft text-danger" },
  { href: "/support/new?type=feature", label: "Özellik öner", Icon: SparkleIcon, tint: "bg-success-soft text-success" },
  { href: "/support/tickets", label: "Destek taleplerim", Icon: InboxIcon, tint: "bg-warning-soft text-warning" },
];

export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const categorySlug = params.category && /^[a-z0-9-]{1,80}$/.test(params.category) ? params.category : null;

  let loadError = false;
  let results: HelpArticleListItem[] = [];
  let categoryView: Awaited<ReturnType<typeof getCategoryWithArticles>> = null;
  let categories: HelpCategory[] = [];
  let faqs: HelpArticleListItem[] = [];

  try {
    if (query) {
      results = await searchHelpArticles(supabase, query);
    } else if (categorySlug) {
      categoryView = await getCategoryWithArticles(supabase, categorySlug);
    } else {
      [categories, faqs] = await Promise.all([getHelpCategories(supabase), getFaqArticles(supabase)]);
    }
  } catch {
    loadError = true;
  }

  const title = categoryView ? categoryView.category.title : "Yardım Merkezi";

  return (
    <AppShell variant="subpage" title={title} parentHref={categoryView ? "/help" : "/home"}>
      <div className="flex min-w-0 flex-col gap-5 pb-4 pt-3">
        <HelpSearchBox key={query} initialQuery={query} />

        {loadError ? (
          <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            Yardım içerikleri şu an yüklenemedi. Lütfen sayfayı yenile.
            <Link href="/support/new" className="mt-2 block font-bold">
              Yine de destek talebi oluştur →
            </Link>
          </div>
        ) : query ? (
          <section aria-labelledby="results-title" className="flex flex-col gap-2">
            <h2 id="results-title" className="text-sm font-semibold text-text-secondary">
              &ldquo;{query}&rdquo; için {results.length} sonuç
            </h2>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-strong p-5 text-center">
                <p className="text-sm font-semibold text-text-primary">Aradığını bulamadık</p>
                <p className="mt-1 text-xs text-text-muted">
                  Farklı kelimelerle aramayı deneyebilir ya da doğrudan bize yazabilirsin.
                </p>
                <Link
                  href={`/support/new?subject=${encodeURIComponent(query)}`}
                  className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-text-on-accent"
                >
                  Destek talebi oluştur
                </Link>
              </div>
            ) : (
              results.map((a) => <ArticleListItem key={a.id} article={a} showCategory />)
            )}
          </section>
        ) : categorySlug ? (
          categoryView ? (
            <section className="flex flex-col gap-2">
              {categoryView.category.description ? (
                <p className="text-sm text-text-muted">{categoryView.category.description}</p>
              ) : null}
              {categoryView.articles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border-strong p-5 text-center text-sm text-text-muted">
                  Bu kategoride henüz makale yok.
                </p>
              ) : (
                categoryView.articles.map((a) => <ArticleListItem key={a.id} article={a} />)
              )}
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-border-strong p-5 text-center text-sm text-text-muted">
              Kategori bulunamadı.{" "}
              <Link href="/help" className="font-semibold text-accent">
                Yardım Merkezi&apos;ne dön
              </Link>
            </p>
          )
        ) : (
          <>
            <nav aria-label="Destek kısayolları" className="grid grid-cols-2 gap-2">
              {SHORTCUTS.map(({ href, label, Icon, tint }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:bg-surface-muted"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}>
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-semibold leading-tight text-text-primary">{label}</span>
                </Link>
              ))}
            </nav>

            {faqs.length > 0 ? (
              <section aria-labelledby="faq-title" className="flex flex-col gap-2">
                <h2 id="faq-title" className="text-sm font-semibold text-text-secondary">
                  Sık sorulan sorular
                </h2>
                {faqs.map((a) => (
                  <ArticleListItem key={a.id} article={a} />
                ))}
              </section>
            ) : null}

            <section aria-labelledby="categories-title" className="flex flex-col gap-2">
              <h2 id="categories-title" className="text-sm font-semibold text-text-secondary">
                Kategoriler
              </h2>
              {categories.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border-strong p-5 text-center text-sm text-text-muted">
                  Henüz yardım içeriği eklenmedi.
                </p>
              ) : (
                <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                  {categories.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/help?category=${c.slug}`}
                      className={`flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">{c.title}</span>
                        {c.description ? <span className="block truncate text-xs text-text-muted">{c.description}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-text-muted">{c.articleCount}</span>
                      <ChevronRightIcon />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
