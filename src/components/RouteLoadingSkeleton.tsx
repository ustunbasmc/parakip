import { AppShell } from "@/components/AppShell";

/**
 * Tüm öncelikli rotaların (home/accounts/transactions/debts/budgets/
 * investments/reports) `loading.tsx` dosyalarında kullanılan ortak
 * iskelet — "geçiş sırasında boş beyaz ekran gösterme" kuralını tek bir
 * yerden karşılar. Next.js App Router bu dosyayı sayfa verisi sunucudan
 * gelene kadar OTOMATİK gösterir. İlk blok hero kartın, diğerleri
 * ikincil kartların yerini tutar; ışık süpürmesi (.skeleton)
 * prefers-reduced-motion'da durur.
 */
export function RouteLoadingSkeleton({ title, rows = 5 }: { title?: string; rows?: number }) {
  return (
    <AppShell title={title ?? "Parakip"}>
      <div className="flex flex-col gap-4 pt-2" role="status" aria-label="Yükleniyor">
        <div className="skeleton h-40 rounded-3xl" />
        {Array.from({ length: Math.max(rows - 1, 1) }).map((_, i) => (
          <div key={i} className="surface-card flex flex-col gap-3 rounded-3xl p-4">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 rounded-xl" />
              <div className="skeleton h-3.5 w-28 rounded" />
            </div>
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
