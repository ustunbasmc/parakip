import Link from "next/link";

/**
 * Admin detay sayfalarının hiyerarşik geri bağlantısı — her zaman ebeveyn
 * listeye gider (tarayıcı geçmişine bakmaz), bkz. lib/navigation/parentRoutes.ts.
 */
export function AdminBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="w-fit text-sm font-semibold text-accent">
      ← {label}
    </Link>
  );
}
