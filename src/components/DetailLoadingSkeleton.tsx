import { AppShell } from "@/components/AppShell";

/**
 * Detay sayfaları (hesap/borç/işlem/yatırım/bütçe/müşteri/tedarikçi)
 * için ortak yükleme iskeleti — RouteLoadingSkeleton'ın (liste sayfaları
 * için) detay-sayfası eşdeğeri. Üstte büyük bir özet kartı + altta
 * birkaç satır iskeleti gösterir, "boş beyaz ekran" olmaz.
 */
export function DetailLoadingSkeleton({ title }: { title?: string }) {
  return (
    <AppShell variant="subpage" title={title ?? "Yükleniyor"} backFallbackHref="/home">
      <div className="flex flex-col gap-4 pt-3">
        <div className="animate-pulse rounded-2xl border border-border bg-surface p-6">
          <div className="mx-auto mb-3 h-3 w-24 rounded bg-surface-muted" />
          <div className="mx-auto h-9 w-40 rounded bg-surface-muted" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 h-3 w-20 rounded bg-surface-muted" />
            <div className="h-5 w-32 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
