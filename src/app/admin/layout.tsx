import { redirect, notFound } from "next/navigation";
import { getAdminDbClient, getCurrentUserAndAdminStatus } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Admin | Parakip", robots: { index: false, follow: false } };

/**
 * /admin altındaki TÜM sayfaların TEK, merkezi koruma noktası. Bu
 * kontrol middleware'de DEĞİL (bkz. proxy.ts — middleware her istekte
 * ek DB sorgusu yapmaz ilkesi) burada, server component'te yapılır.
 *
 * Oturum yoksa normal "/welcome'a yönlendir" kuralı zaten proxy.ts'te
 * devrede — burada YALNIZCA "oturumu olan ama platform admin'i OLMAYAN"
 * kullanıcıyı engelliyoruz. Admin OLMAYAN bir kullanıcıya "/admin var"
 * bilgisini bile SIZDIRMAMAK için 404 (notFound) kullanılır.
 *
 * NOT: Server Action'lar bu layout'tan GEÇMEZ — her aksiyon kendi
 * içinde assertAdmin() yapar.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();

  if (!user) redirect("/welcome");
  if (!isAdmin) notFound();

  // Menü rozetleri — sayım hatası paneli kilitlemesin diye 0'a düşer.
  const supabase = getAdminDbClient();
  const [payments, support, deletions, errors] = await Promise.all([
    supabase.from("manual_payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_review"]),
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .not("deletion_requested_at", "is", null)
      .is("deletion_completed_at", null),
    supabase.from("app_error_events").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  return (
    <AdminShell
      adminEmail={user.email ?? null}
      badges={{ payments: payments.count ?? 0, support: support.count ?? 0, deletions: deletions.count ?? 0, errors: errors.count ?? 0 }}
    >
      {children}
    </AdminShell>
  );
}
