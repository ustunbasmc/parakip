import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import { AdminUserEditForm } from "@/components/admin/AdminUserEditForm";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getAdminDbClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name, first_name, last_name, phone, avatar_url, deletion_requested_at, created_at")
    .eq("user_id", id)
    .maybeSingle();

  if (!profile) notFound();

  // Kullanıcının SAHİBİ olduğu tüm alanlar (Ev + İşletme).
  const { data: ownedSpaces } = await supabase
    .from("spaces")
    .select("id, name, type, created_at")
    .eq("owner_user_id", id)
    .order("created_at", { ascending: false });

  // Kullanıcının ÜYESİ olduğu (sahip olmasa bile) tüm alanlar.
  const { data: memberships } = await supabase
    .from("space_members")
    .select("role, spaces(id, name, type)")
    .eq("user_id", id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-accent">
          ← Kullanıcılar
        </Link>
        <h1 className="mt-2 text-xl font-extrabold text-text-primary">
          {profile.display_name || "İsimsiz kullanıcı"}
        </h1>
        <p className="text-xs text-text-muted">Kullanıcı ID: {profile.user_id}</p>
      </div>

      <AdminUserEditForm
        userId={profile.user_id}
        firstName={profile.first_name}
        lastName={profile.last_name}
        phone={profile.phone}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Sahip olduğu alanlar</p>
        {ownedSpaces && ownedSpaces.length > 0 ? (
          <div className="flex flex-col gap-2">
            {ownedSpaces.map((s) => (
              <Link
                key={s.id}
                href={`/admin/spaces/${s.id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
              >
                <span className="text-sm font-medium text-text-primary">{s.name}</span>
                <span className="text-xs text-text-muted">{s.type === "home" ? "Ev" : "İşletme"}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Sahip olduğu bir alan yok.</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-text-primary">Üye olduğu diğer alanlar</p>
        {memberships && memberships.length > 0 ? (
          <div className="flex flex-col gap-2">
            {memberships.map((m, i) => {
              const space = Array.isArray(m.spaces) ? m.spaces[0] : m.spaces;
              if (!space) return null;
              return (
                <Link
                  key={i}
                  href={`/admin/spaces/${space.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface p-3.5"
                >
                  <span className="text-sm font-medium text-text-primary">{space.name}</span>
                  <span className="text-xs text-text-muted">{m.role}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Başka bir alana üye değil.</p>
        )}
      </div>
    </div>
  );
}
