import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { ArticleFeedback } from "@/components/help/ArticleFeedback";
import { ArticleListItem } from "@/components/help/ArticleListItem";
import {
  getHelpArticle,
  getMyArticleFeedback,
  getRelatedArticles,
  safeInternalPath,
} from "@/lib/help/queries";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const article = /^[a-z0-9-]{1,120}$/.test(slug) ? await getHelpArticle(supabase, slug) : null;
  return { title: `${article?.title ?? "Yardım"} | Parakip` };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) notFound();

  // RLS: taslak/arşiv makale burada null döner → 404 (varlığı bile sızdırılmaz).
  const article = await getHelpArticle(supabase, slug);
  if (!article) notFound();

  const [related, myFeedback] = await Promise.all([
    getRelatedArticles(supabase, article.categoryId, article.id),
    getMyArticleFeedback(supabase, article.id, user.id),
  ]);

  const relatedPath = safeInternalPath(article.relatedPath);
  const paragraphs = article.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <AppShell variant="subpage" title="Yardım" parentHref="/help">
      <article className="flex min-w-0 flex-col gap-5 pb-4 pt-3">
        <header>
          {article.categorySlug ? (
            <Link href={`/help?category=${article.categorySlug}`} className="text-xs font-semibold text-accent">
              {article.categoryTitle}
            </Link>
          ) : null}
          <h1 className="mt-1 text-xl font-extrabold text-text-primary">{article.title}</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-text-secondary">{article.summary}</p>
        </header>

        {article.steps.length > 0 ? (
          <section aria-labelledby="steps-title" className="rounded-2xl border border-border bg-surface p-4">
            <h2 id="steps-title" className="text-sm font-bold text-text-primary">
              Adım adım
            </h2>
            <ol className="mt-3 flex flex-col gap-3">
              {article.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-0.5 text-sm leading-relaxed text-text-primary">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {paragraphs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line break-words text-sm leading-relaxed text-text-secondary">
                {p}
              </p>
            ))}
          </div>
        ) : null}

        {relatedPath ? (
          <Link
            href={relatedPath}
            className="flex h-12 items-center justify-center rounded-2xl bg-accent px-5 text-sm font-bold text-text-on-accent"
          >
            {article.relatedLabel || "İlgili ekrana git"}
          </Link>
        ) : null}

        <ArticleFeedback articleId={article.id} articleSlug={article.slug} initial={myFeedback} />

        {related.length > 0 ? (
          <section aria-labelledby="related-title" className="flex flex-col gap-2">
            <h2 id="related-title" className="text-sm font-semibold text-text-secondary">
              İlgili makaleler
            </h2>
            {related.map((a) => (
              <ArticleListItem key={a.id} article={a} />
            ))}
          </section>
        ) : null}

        <p className="text-center text-xs text-text-muted">
          Aradığını bulamadın mı?{" "}
          <Link href={`/support/new?article=${article.slug}`} className="font-semibold text-accent">
            Bize yaz
          </Link>
        </p>
      </article>
    </AppShell>
  );
}
