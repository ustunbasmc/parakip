import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";

export default async function AdminDashboardPage() {
  const supabase = getAdminDbClient();

  const [users, spaces, transactions] = await Promise.all([
    supabase.from("profiles").select("user_id", { count: "exact", head: true }),
    supabase.from("spaces").select("id", { count: "exact", head: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Toplam kullanıcı", value: users.count ?? 0 },
    { label: "Toplam alan (Ev+İşletme)", value: spaces.count ?? 0 },
    { label: "Toplam işlem", value: transactions.count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary">Yönetim Paneli</h1>
        <p className="mt-1 text-sm text-text-muted">
          Bu panel service_role ile çalışır — RLS bypass edilir, tüm veriye tam erişim vardır. Her
          değişiklik <code className="rounded bg-surface-muted px-1">platform_admin_audit_log</code>&apos;a
          kaydedilir.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      <Link
        href="/admin/users"
        className="inline-block w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-text-on-accent"
      >
        Tüm kullanıcıları görüntüle →
      </Link>
    </div>
  );
}
