"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHelpCategory } from "@/app/admin/help/actions";

export interface AdminCategory {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  articleCount: number;
  publishedCount: number;
}

type Draft = Omit<AdminCategory, "id" | "articleCount" | "publishedCount"> & { id: string | null };

const EMPTY: Draft = { id: null, slug: "", title: "", description: "", sortOrder: 100, isActive: true };

const inputClass = "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text-primary";

function slugify(text: string) {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (ch) => map[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function CategoryForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    id: initial.id,
    slug: initial.slug,
    title: initial.title,
    description: initial.description,
    sortOrder: initial.sortOrder,
    isActive: initial.isActive,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isNew = initial.id === null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveHelpCategory(draft);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Başlık
          <input
            className={inputClass}
            value={draft.title}
            maxLength={80}
            required
            onChange={(e) => {
              const title = e.target.value;
              // Yeni kategoride slug elle değiştirilmediyse başlıktan türetilir.
              setDraft((d) => ({ ...d, title, slug: isNew && d.slug === slugify(d.title) ? slugify(title) : d.slug }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Slug
          <input
            className={inputClass}
            value={draft.slug}
            maxLength={80}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
        Açıklama
        <input
          className={inputClass}
          value={draft.description}
          maxLength={240}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex w-32 flex-col gap-1 text-xs font-semibold text-text-muted">
          Sıra
          <input
            type="number"
            className={inputClass}
            value={draft.sortOrder}
            onChange={(e) => setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
          />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm font-semibold text-text-primary">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))} />
          Aktif (kullanıcılara görünür)
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-xl bg-accent px-4 text-sm font-bold text-text-on-accent disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : isNew ? "Kategori ekle" : "Kaydet"}
        </button>
        <button type="button" onClick={onDone} className="h-10 rounded-xl px-3 text-sm font-semibold text-text-muted">
          Vazgeç
        </button>
      </div>
    </form>
  );
}

export function AdminCategoryEditor({ categories }: { categories: AdminCategory[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {editing === "new" ? (
        <CategoryForm initial={EMPTY} onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="self-start rounded-full bg-accent px-4 py-2 text-sm font-bold text-text-on-accent"
        >
          Yeni kategori
        </button>
      )}

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">Kategori yok.</p>
      ) : (
        categories.map((c) =>
          editing === c.id ? (
            <CategoryForm key={c.id} initial={c} onDone={() => setEditing(null)} />
          ) : (
            <div
              key={c.id}
              className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-muted">
                  /{c.slug} · sıra {c.sortOrder} · {c.publishedCount}/{c.articleCount} makale yayında
                </p>
                <p className="truncate text-sm font-semibold text-text-primary">{c.title}</p>
                {c.description ? <p className="truncate text-xs text-text-secondary">{c.description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    c.isActive ? "bg-success-soft text-success" : "bg-surface-muted text-text-muted"
                  }`}
                >
                  {c.isActive ? "Aktif" : "Pasif"}
                </span>
                <button type="button" onClick={() => setEditing(c.id)} className="text-sm font-semibold text-accent">
                  Düzenle
                </button>
              </div>
            </div>
          )
        )
      )}
    </div>
  );
}
