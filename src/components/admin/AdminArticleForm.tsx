"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHelpArticle, setHelpArticleStatus } from "@/app/admin/help/actions";

export interface AdminArticleFormValues {
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

const STATUS_LABELS: Record<string, string> = { draft: "Taslak", published: "Yayında", archived: "Arşiv" };

/** Türkçe karakterleri ASCII'ye çevirip URL uyumlu slug üretir. */
function slugify(text: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıiöşüâîû]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "flex flex-col gap-1 text-xs font-semibold text-text-muted";

export function AdminArticleForm({
  initial,
  categories,
}: {
  initial: AdminArticleFormValues;
  categories: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [stepsText, setStepsText] = useState(initial.steps.join("\n"));
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [contextText, setContextText] = useState(initial.contextKeys.join(", "));
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof AdminArticleFormValues>(key: K, value: AdminArticleFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function save(statusOverride?: string) {
    if (pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveHelpArticle({
        ...v,
        status: statusOverride ?? v.status,
        steps: stepsText.split("\n"),
        tags: tagsText.split(","),
        contextKeys: contextText.split(","),
      }).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : "Hata" }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (statusOverride) update("status", statusOverride);
      setMessage("Kaydedildi.");
      if (!v.id) router.replace(`/admin/help/${result.id}`);
      else router.refresh();
    });
  }

  function changeStatus(status: string) {
    if (!v.id || pending) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setHelpArticleStatus(v.id!, status).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "Hata",
      }));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      update("status", status);
      setMessage(`Durum: ${STATUS_LABELS[status]}`);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-text-secondary">
          {STATUS_LABELS[v.status] ?? v.status}
        </span>
        {v.id ? (
          <>
            {v.status !== "published" ? (
              <button type="button" disabled={pending} onClick={() => changeStatus("published")} className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
                Yayınla
              </button>
            ) : null}
            {v.status !== "draft" ? (
              <button type="button" disabled={pending} onClick={() => changeStatus("draft")} className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-text-secondary">
                Taslağa al
              </button>
            ) : null}
            {v.status !== "archived" ? (
              <button type="button" disabled={pending} onClick={() => changeStatus("archived")} className="rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-danger">
                Arşivle
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Başlık
          <input
            className={inputClass}
            value={v.title}
            maxLength={140}
            onChange={(e) => {
              update("title", e.target.value);
              if (!slugTouched) update("slug", slugify(e.target.value));
            }}
            required
          />
        </label>
        <label className={labelClass}>
          Slug (adres)
          <input
            className={inputClass}
            value={v.slug}
            maxLength={120}
            onChange={(e) => {
              setSlugTouched(true);
              update("slug", e.target.value);
            }}
            required
          />
        </label>
        <label className={labelClass}>
          Kategori
          <select className={inputClass} value={v.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
            <option value="" disabled>
              Seç
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Sıra (küçük önce)
          <input
            type="number"
            className={inputClass}
            value={v.sortOrder}
            onChange={(e) => update("sortOrder", Number(e.target.value))}
          />
        </label>
      </div>

      <label className={labelClass}>
        Kısa açıklama (özet)
        <textarea className={inputClass} rows={2} maxLength={400} value={v.summary} onChange={(e) => update("summary", e.target.value)} required />
      </label>

      <label className={labelClass}>
        Adımlar (her satır bir adım)
        <textarea className={inputClass} rows={5} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </label>

      <label className={labelClass}>
        İçerik (düz metin; paragrafları boş satırla ayır)
        <textarea className={inputClass} rows={8} maxLength={20000} value={v.body} onChange={(e) => update("body", e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Etiketler (virgülle)
          <input className={inputClass} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </label>
        <label className={labelClass}>
          Bağlam anahtarları (virgülle, ör. budgets)
          <input className={inputClass} value={contextText} onChange={(e) => setContextText(e.target.value)} />
        </label>
        <label className={labelClass}>
          İlgili ekran yolu (ör. /budgets)
          <input className={inputClass} value={v.relatedPath} onChange={(e) => update("relatedPath", e.target.value)} />
        </label>
        <label className={labelClass}>
          Buton metni (ör. Bütçelere git)
          <input className={inputClass} maxLength={60} value={v.relatedLabel} onChange={(e) => update("relatedLabel", e.target.value)} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input type="checkbox" checked={v.isFaq} onChange={(e) => update("isFaq", e.target.checked)} className="h-4 w-4" />
        Sık sorulan sorularda göster
      </label>

      {error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="h-11 rounded-xl bg-accent px-5 text-sm font-bold text-text-on-accent disabled:opacity-50">
          {pending ? "Kaydediliyor..." : v.id ? "Kaydet" : "Taslak olarak kaydet"}
        </button>
        {!v.id ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save("published")}
            className="h-11 rounded-xl bg-success-soft px-5 text-sm font-bold text-success disabled:opacity-50"
          >
            Kaydet ve yayınla
          </button>
        ) : null}
      </div>
    </form>
  );
}
