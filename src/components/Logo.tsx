import Image from "next/image";

/**
 * Parakip logosu — gerçek marka ikonu (public/brand/icon-192.png,
 * kendi kare/yuvarlak köşeli koyu arka planını taşıyan tasarım) ve
 * marka wordmark'ı. İkon zaten kendi arka planını içerdiğinden (PNG,
 * şeffaf değil) her iki temada da aynı şekilde, doğrudan kullanılabilir
 * — ayrı açık/koyu varyant GEREKMEZ.
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
      <Image
        src="/brand/icon-192.png"
        alt=""
        width={34}
        height={34}
        className="rounded-[9px]"
        priority
      />
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

