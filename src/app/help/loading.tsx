/**
 * Yardım merkezi herkese açık olduğu için yükleme iskeleti uygulama
 * menüsünü (AppShell) göstermez; hem ziyaretçi hem kullanıcı için sade.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-surface-muted" />
      <div className="h-12 w-full animate-pulse rounded-2xl bg-surface-muted" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-surface-muted" />
      ))}
    </div>
  );
}
