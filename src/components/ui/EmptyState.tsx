import type { ReactNode } from "react";
import Link from "next/link";
import { InboxIcon } from "@/components/icons";

/**
 * Ortak boş durum — küçük ikon rozeti (CSS gradyan halka), kısa başlık,
 * yönlendirici açıklama ve isteğe bağlı TEK bir aksiyon. Harici görsel
 * kullanılmaz. Sahte veri ASLA gösterilmez; burası "henüz veri yok"
 * demenin tek yeridir.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** href verilirse Link, node verilirse olduğu gibi (ör. modal açan buton). */
  action?: { href: string; label: string } | ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "gap-1.5 py-4" : "gap-2 py-7"}`}>
      <span
        aria-hidden="true"
        className={`relative flex items-center justify-center rounded-2xl text-accent ${compact ? "h-11 w-11" : "h-14 w-14"}`}
        style={{
          background:
            "radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%), var(--color-accent-soft)",
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 25%, transparent)",
        }}
      >
        {icon ?? <InboxIcon size={compact ? 20 : 24} />}
      </span>
      <p className="mt-1 text-sm font-semibold text-text-primary">{title}</p>
      {description ? <p className="max-w-xs text-xs leading-relaxed text-text-muted">{description}</p> : null}
      {action ? (
        <div className="mt-2">
          {isLinkAction(action) ? (
            <Link
              href={action.href}
              className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-text-on-accent transition-transform active:scale-[0.98]"
              style={{ boxShadow: "var(--glow-accent)" }}
            >
              {action.label}
            </Link>
          ) : (
            action
          )}
        </div>
      ) : null}
    </div>
  );
}

function isLinkAction(a: unknown): a is { href: string; label: string } {
  return typeof a === "object" && a !== null && "href" in a && "label" in a && typeof (a as { href: unknown }).href === "string";
}
