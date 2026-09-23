import { AppShell } from "@/components/AppShell";

/**
 * Alt sayfalar (detaylar, ayarlar, formlar) için ortak yükleme iskeleti —
 * geri butonlu kabuk hemen çizilir, içerik yerinde ışık süpürmeli
 * yer tutucular gösterilir; tıklama sonrası boş/donuk ekran oluşmaz.
 */
export function DetailLoadingSkeleton({ title }: { title?: string }) {
  return (
    <AppShell variant="subpage" title={title ?? "Yükleniyor"}>
      <div className="flex flex-col gap-4 pt-3" role="status" aria-label="Yükleniyor">
        <div className="skeleton h-32 rounded-3xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface-card flex flex-col gap-2.5 rounded-3xl p-4">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-5 w-40 max-w-full rounded" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
