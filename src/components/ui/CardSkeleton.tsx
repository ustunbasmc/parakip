/**
 * Akışlı yüklenen kartların yer tutucusu — kartın gerçek yüksekliğine
 * yakın bir iskelet gösterir; içerik geldiğinde yerleşim zıplamaz.
 */
export function CardSkeleton({
  lines = 3,
  className,
  hero = false,
}: {
  lines?: number;
  className?: string;
  /** Büyük özet kartı görünümü (daha yüksek, başlık rakamı büyük). */
  hero?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label="Yükleniyor"
      className={`surface-card flex min-w-0 flex-col gap-3 rounded-3xl p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="skeleton h-8 w-8 rounded-xl" />
        <div className="skeleton h-3.5 w-28 rounded" />
      </div>
      {hero ? <div className="skeleton h-10 w-56 max-w-full rounded-lg" /> : null}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3 rounded" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}
