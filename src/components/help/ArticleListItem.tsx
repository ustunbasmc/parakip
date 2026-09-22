import Link from "next/link";
import type { HelpArticleListItem } from "@/lib/help/queries";

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-text-muted">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArticleListItem({ article, showCategory = false }: { article: HelpArticleListItem; showCategory?: boolean }) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
    >
      <span className="min-w-0 flex-1">
        {showCategory && article.categoryTitle ? (
          <span className="mb-0.5 block truncate text-xs font-semibold text-accent">{article.categoryTitle}</span>
        ) : null}
        <span className="block text-sm font-semibold text-text-primary">{article.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-text-muted">{article.summary}</span>
      </span>
      <ChevronRight />
    </Link>
  );
}

export function ChevronRightIcon() {
  return <ChevronRight />;
}
