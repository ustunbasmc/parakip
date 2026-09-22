import Link from "next/link";
import { HelpCircleIcon } from "@/components/icons";

/**
 * Bağlam duyarlı yardım bağlantısı — ekranın konusuyla ilgili yardım
 * makalesini doğrudan açar. Başlık alanında ikon olarak (variant="icon")
 * veya form içinde metin bağlantısı olarak (variant="inline") kullanılır.
 */
export function HelpLink({
  slug,
  label = "Yardım",
  variant = "icon",
}: {
  slug: string;
  label?: string;
  variant?: "icon" | "inline";
}) {
  const href = `/help/${slug}`;

  if (variant === "inline") {
    return (
      <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
        <HelpCircleIcon size={14} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted"
    >
      <HelpCircleIcon size={20} />
    </Link>
  );
}
