import type { ReactNode } from "react";
import { InboxIcon, AlertIcon } from "@/components/icons";

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Sağ üstte, ör. "Tümünü gör" gibi bir eylem — yalnızca gerçek bir hedefi
   * varsa geçin, dekoratif olarak eklenmez. */
  action?: ReactNode;
  /** Masaüstü grid düzeninde ör. "lg:col-span-2" gibi ek yerleşim sınıfları için. */
  className?: string;
}

/** Tüm ikincil dashboard kartlarının ortak çerçevesi — sakin, düz, gölgesiz. */
export function DashboardCard({ title, icon, children, action, className }: DashboardCardProps) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className ?? ""}`}>
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-secondary">
          {icon ? <span aria-hidden="true">{icon}</span> : null}
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Veri henüz yoksa gösterilir — ASLA sahte veri üretilmez. Düz bir metin
 * yerine ikon + başlık + yönlendirici mikro-metin ile "burada ne
 * olacağını ve ne yapman gerektiğini" anlatır.
 */
export function CardEmptyState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 text-center">
      <InboxIcon className="text-text-muted" size={26} />
      <p className="text-sm font-medium text-text-secondary">{message}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

/** Henüz geliştirilmemiş bir özellik için — açıkça "yakında" der. */
export function CardComingSoon({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
        Yakında
      </span>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

/** Bir kartın verisi çekilemediğinde — diğer kartları etkilemeden gösterilir. */
export function CardError({ message = "Bu bölüm şu anda yüklenemedi." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-sm text-danger">
      <AlertIcon />
      {message}
    </div>
  );
}
