import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUserAndAdminStatus } from "@/lib/admin/auth";

/**
 * /admin altındaki TÜM sayfaların TEK, merkezi koruma noktası. Bu
 * kontrol middleware'de DEĞİL (bkz. proxy.ts — middleware her istekte
 * ek DB sorgusu yapmaz ilkesi) burada, server component'te yapılır.
 *
 * Oturum yoksa normal "/welcome'a yönlendir" kuralı zaten proxy.ts'te
 * devrede (bu layout'a /admin PUBLIC_PATHS'e EKLENMEDİĞİ için oturumsuz
 * hiç ulaşamaz) — burada YALNIZCA "oturumu olan ama platform admin'i
 * OLMAYAN" kullanıcıyı engelliyoruz. Admin OLMAYAN bir kullanıcıya
 * "/admin var" bilgisini bile SIZDIRMAMAK için 404 (notFound)
 * kullanılır — 403 kullanmak "böyle bir sayfa var ama yetkin yok"
 * bilgisini verir, bu daha az bilgi sızdıran bir tercihtir.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();

  if (!user) redirect("/welcome");
  if (!isAdmin) notFound();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg-elevated px-5 py-3">
        <Link href="/admin" className="text-sm font-extrabold text-text-primary">
          Parakip Admin
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-text-secondary">
          <Link href="/admin/users" className="hover:text-text-primary">
            Kullanıcılar
          </Link>
        </nav>
        <Link href="/home" className="ml-auto text-xs font-semibold text-accent">
          Uygulamaya dön
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
