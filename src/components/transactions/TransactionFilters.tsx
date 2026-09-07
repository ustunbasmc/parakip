"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchIcon, FilterIcon, XIcon } from "@/components/icons";
import type { AccountOption, CategoryOption } from "@/lib/dashboard/formData";

const KIND_TABS: { value: string; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
  { value: "transfer", label: "Transfer" },
  { value: "investment", label: "Yatırım" },
];

interface Props {
  accounts: (AccountOption & { isArchived: boolean })[];
  categories: CategoryOption[];
}

/**
 * Tüm filtreler URL search param'larına yazılır — "sayfa yenilendiğinde
 * filtreler korunabilsin" kuralı böylece otomatik sağlanır (Server
 * Component her zaman URL'den okur, ekstra bir client state/localStorage
 * gerekmez).
 */
export function TransactionFilters({ accounts, categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kind = searchParams.get("kind") ?? "all";
  const accountId = searchParams.get("account") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const status = searchParams.get("status") ?? "active";

  const activeSecondaryCount =
    [accountId, categoryId, dateFrom, dateTo].filter(Boolean).length + (status !== "active" ? 1 : 0);

  // URL'de (ör. hesap detayından "Tüm işlemleri gör" ile) zaten bir ikincil
  // filtre varsa, panel BAŞTAN açık gelir — kullanıcı neyin filtrelendiğini
  // görmeden ekranı terk etmesin diye.
  const [panelOpen, setPanelOpen] = useState(activeSecondaryCount > 0);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", searchDraft.trim());
  }

  function clearSecondaryFilters() {
    const next = new URLSearchParams(searchParams.toString());
    ["account", "category", "from", "to"].forEach((k) => next.delete(k));
    next.set("status", "active");
    router.push(`${pathname}?${next.toString()}`);
    setPanelOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form onSubmit={handleSearchSubmit} className="relative">
        <SearchIcon
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Açıklamada ara"
          className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-[0.9375rem] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </form>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => updateParam("kind", tab.value === "all" ? "" : tab.value)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                kind === tab.value ? "bg-accent text-text-on-accent" : "bg-surface-muted text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
            activeSecondaryCount > 0 ? "border-accent text-accent" : "border-border text-text-secondary"
          }`}
        >
          <FilterIcon size={15} />
          Filtrele
          {activeSecondaryCount > 0 ? (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-text-on-accent">
              {activeSecondaryCount}
            </span>
          ) : null}
        </button>
      </div>

      {panelOpen ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Diğer filtreler</p>
            <button onClick={() => setPanelOpen(false)} aria-label="Kapat" className="text-text-muted">
              <XIcon size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Hesap</label>
            <select
              value={accountId}
              onChange={(e) => updateParam("account", e.target.value)}
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text-primary"
            >
              <option value="">Tüm hesaplar</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.isArchived ? " (arşivlenmiş)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => updateParam("category", e.target.value)}
              className="h-11 rounded-xl border border-border bg-bg px-3 text-sm text-text-primary"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Başlangıç</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => updateParam("from", e.target.value)}
                className="h-11 rounded-xl border border-border bg-bg px-2.5 text-sm text-text-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Bitiş</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => updateParam("to", e.target.value)}
                className="h-11 rounded-xl border border-border bg-bg px-2.5 text-sm text-text-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Durum</label>
            <div className="flex gap-1 rounded-full bg-surface-muted p-1">
              {[
                { value: "active", label: "Aktif" },
                { value: "cancelled", label: "İptal edilmiş" },
                { value: "all", label: "Tümü" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateParam("status", opt.value === "active" ? "" : opt.value)}
                  className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${
                    status === opt.value ? "bg-accent text-text-on-accent" : "text-text-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {activeSecondaryCount > 0 ? (
            <button onClick={clearSecondaryFilters} className="text-center text-sm font-semibold text-accent">
              Filtreleri temizle
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
