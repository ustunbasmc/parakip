/**
 * Parakip logosu. "İki tema uyumlu varyant" kuralı, iki ayrı sabit-renkli
 * dosya yerine TEK bir SVG'nin CSS değişkenleriyle (design tokens)
 * boyanmasıyla sağlanıyor — renkleri doğrudan bileşene yazmama kuralıyla
 * tutarlı olması için. Sonuç aynı: Gece Modu'nda mark/wordmark otomatik
 * olarak koyu tema tonlarına, Gündüz Modu'nda açık tema tonlarına döner,
 * tema değişince (next-themes ile) yeniden render gerekmeden anında güncellenir.
 */
export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="17" cy="17" r="17" fill="var(--color-accent)" />
        <path
          d="M11 21.5V12.8c0-.44.36-.8.8-.8h4.2c2.32 0 4.2 1.7 4.2 4s-1.88 4-4.2 4h-2.2v1.5"
          stroke="var(--color-text-on-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark ? (
        <span
          className="text-[1.35rem] font-extrabold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          parakip
        </span>
      ) : null}
    </span>
  );
}
