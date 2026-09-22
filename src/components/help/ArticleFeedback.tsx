"use client";

import { useState } from "react";
import Link from "next/link";
import { submitArticleFeedback } from "@/app/support/actions";

/** "Bu makale sorunu çözdü mü?" — Hayır seçilirse destek talebi bağlantısı açılır. */
export function ArticleFeedback({
  articleId,
  articleSlug,
  initial,
}: {
  articleId: string;
  articleSlug: string;
  initial: boolean | null;
}) {
  const [answer, setAnswer] = useState<boolean | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(helpful: boolean) {
    if (saving) return;
    setSaving(true);
    setError(null);
    const previous = answer;
    setAnswer(helpful);
    const result = await submitArticleFeedback({ articleId, helpful });
    setSaving(false);
    if (!result.ok) {
      setAnswer(previous);
      setError(result.error);
    }
  }

  const optionClass = (selected: boolean) =>
    `flex-1 rounded-full border py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
      selected ? "border-accent bg-accent text-text-on-accent" : "border-border bg-surface text-text-primary hover:bg-surface-muted"
    }`;

  return (
    <section aria-labelledby="feedback-title" className="rounded-2xl border border-border bg-surface p-4">
      <p id="feedback-title" className="text-sm font-semibold text-text-primary">
        Bu makale sorunu çözdü mü?
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose(true)} disabled={saving} aria-pressed={answer === true} className={optionClass(answer === true)}>
          Evet
        </button>
        <button type="button" onClick={() => choose(false)} disabled={saving} aria-pressed={answer === false} className={optionClass(answer === false)}>
          Hayır
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : answer === true ? (
        <p role="status" className="mt-3 text-sm text-text-secondary">
          Harika, geri bildirimin için teşekkürler!
        </p>
      ) : answer === false ? (
        <div role="status" className="mt-3 rounded-xl bg-surface-muted p-3">
          <p className="text-sm text-text-secondary">Üzgünüz, bu makale yeterli olmadı. Ekibimiz sana yardımcı olsun.</p>
          <Link
            href={`/support/new?article=${encodeURIComponent(articleSlug)}`}
            className="mt-2 inline-block text-sm font-bold text-accent"
          >
            Destek talebi oluştur →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
