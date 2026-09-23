import type { ReactNode } from "react";
import Link from "next/link";
import { AlertIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/EmptyState";

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  /** Başlığın altında kısa, gri açıklama (ör. dönem adı). */
  subtitle?: string;
  children: ReactNode;
  /** Sağ üstte, ör. "Tümünü gör" gibi bir eylem — yalnızca gerçek bir hedefi
   * varsa geçin, dekoratif olarak eklenmez. */
  action?: ReactNode;
  /** Masaüstü grid düzeninde ör. "lg:col-span-2" gibi ek yerleşim sınıfları için. */
  className?: string;
  /** Kartların sırayla, yumuşak görünmesi için (ms). */
  delay?: number;
}

/**
 * Tüm ikincil dashboard kartlarının ortak çerçevesi — hafif dikey
 * gradyan, ince kenar (.surface-card). Neon/parlama YALNIZCA hero kartta
 * kullanılır; bu kartlar sakin kalır ki içerik öne çıksın.
 */
export function DashboardCard({ title, icon, subtitle, children, action, className, delay = 0 }: DashboardCardProps) {
  return (
    <section
      className={`surface-card animate-rise min-w-0 rounded-3xl p-3.5 sm:p-5 ${className ?? ""}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-text-primary">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-text-muted">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0 pt-1">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Veri henüz yoksa gösterilir — ASLA sahte veri üretilmez. Ortak
 * EmptyState'in kart içi (kompakt) hali; isteğe bağlı tek bir aksiyonla
 * kullanıcıyı ne yapması gerektiğine yönlendirir.
 */
export function CardEmptyState({
  message,
  hint,
  action,
  icon,
}: {
  message: string;
  hint?: string;
  action?: { href: string; label: string } | ReactNode;
  icon?: ReactNode;
}) {
  return <EmptyState compact title={message} description={hint} action={action} icon={icon} />;
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
    <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger">
      <AlertIcon />
      {message}
    </div>
  );
}

/** "Tümünü gör" bağlantılarının ortak görünümü. */
export function CardLink({ href, children = "Tümünü gör" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-2 py-1 text-xs font-bold text-accent hover:bg-accent-soft">
      {children}
    </Link>
  );
}
