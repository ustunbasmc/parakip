"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "@/components/icons";

/**
 * Yardım araması — yazarken 300 ms bekleyip URL'yi (?q=) günceller;
 * arama sunucuda PostgreSQL fonksiyonu (search_help_articles) ile yapılır.
 * router.replace kullanılır: her tuş vuruşu geçmişe yeni bir kayıt
 * eklemez, cihaz geri tuşu kullanıcıyı bir önceki ekrana götürür.
 */
export function HelpSearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef(initialQuery);

  function go(q: string) {
    const trimmed = q.trim();
    if (trimmed === lastPushedRef.current) return;
    lastPushedRef.current = trimmed;
    startTransition(() => {
      router.replace(trimmed ? `/help?q=${encodeURIComponent(trimmed)}` : "/help", { scroll: false });
    });
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => go(next), 300);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        go(value);
      }}
      className="relative"
    >
      <label htmlFor="help-search" className="sr-only">
        Yardım makalelerinde ara
      </label>
      <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        id="help-search"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={100}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ne öğrenmek istiyorsun? (ör. gider ekleme)"
        className="h-14 w-full rounded-2xl border border-border bg-surface pl-11 pr-11 text-[1.0625rem] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {pending ? (
        <span
          className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
          aria-label="Aranıyor"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setValue("");
            go("");
          }}
          aria-label="Aramayı temizle"
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted"
        >
          <XIcon size={16} />
        </button>
      ) : null}
    </form>
  );
}
