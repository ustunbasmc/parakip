import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";

/**
 * Tüm öncelikli rotaların (home/accounts/transactions/debts/budgets/
 * investments/reports) `loading.tsx` dosyalarında kullanılan ortak
 * iskelet — "geçiş sırasında boş beyaz ekran gösterme" kuralını tek bir
 * yerden, kod tekrarı olmadan karşılar. Next.js App Router bu dosyayı
 * sayfa verisi sunucudan gelene kadar OTOMATİK gösterir (React Suspense
 * sınırı), ekstra bir mantık gerekmez. Ortadaki nabız gibi (pulse) atan
 * logo, geçişi "boş bekleme" yerine markalı, canlı bir an olarak
 * hissettirir.
 */
export function RouteLoadingSkeleton({ title, rows = 5 }: { title?: string; rows?: number }) {
  return (
    <AppShell title={title ?? "Parakip"}>
      <div className="flex flex-col items-center gap-1 pb-2 pt-6 opacity-70">
        <Logo withWordmark={false} className="animate-pulse" />
      </div>
      <div className="flex flex-col gap-4 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 h-3 w-24 rounded bg-surface-muted" />
            <div className="h-7 w-32 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
