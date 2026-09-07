import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";

export default async function AdminUsersPage() {
  const supabase = getAdminDbClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, first_name, last_name, phone, deletion_requested_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <p className="text-sm text-danger">Kullanıcılar yüklenemedi: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold text-text-primary">Kullanıcılar</h1>
        <p className="mt-1 text-sm text-text-muted">Son 200 kayıt, kayıt tarihine göre azalan sırada.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2.5">Ad Soyad</th>
              <th className="px-4 py-2.5">Telefon</th>
              <th className="px-4 py-2.5">Kayıt Tarihi</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {(profiles ?? []).map((p) => (
              <tr key={p.user_id}>
                <td className="px-4 py-2.5 font-medium text-text-primary">
                  {p.display_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—"}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{p.phone || "—"}</td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString("tr-TR") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {p.deletion_requested_at ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">
                      Silme talep edildi
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                      Aktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/users/${p.user_id}`} className="text-xs font-semibold text-accent">
                    Detay →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
