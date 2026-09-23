import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { getManagedSpaces } from "@/lib/dashboard/formData";
import { getSpaceMembers, type InvitableRole } from "@/lib/api/members-rpc";
import { MembersManager, type PendingInvitation } from "@/components/spaces/MembersManager";

/** Sayfa isteği anında süresi dolmuş mu (render dışında hesaplanır). */
function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bir alanın üyeleri ve davetleri. Tüm üyeler listeyi görür; davet
 * gönderme, rol değiştirme ve üye çıkarma yalnızca sahip/yöneticiye
 * açıktır (kurallar veritabanında, bkz. migration 0065).
 */
export default async function SpaceMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const space = (await getManagedSpaces(supabase)).find((s) => s.id === id);
  if (!space) notFound();

  const canManage = space.role === "owner" || space.role === "admin";
  const [members, invitations] = await Promise.all([
    getSpaceMembers(supabase, id).catch(() => []),
    canManage
      ? supabase
          .from("space_invitations")
          .select("id, email, role, token, created_at, expires_at")
          .eq("space_id", id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),
  ]);

  const pending: PendingInvitation[] = invitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role as InvitableRole,
    token: i.token,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    expired: isPast(i.expires_at),
  }));

  return (
    <AppShell variant="subpage" title={`${space.name} · Üyeler`} parentHref="/settings/spaces">
      <MembersManager
        spaceId={space.id}
        spaceName={space.name}
        isArchived={space.isArchived}
        myRole={space.role as "owner" | "admin" | "editor" | "viewer"}
        myUserId={user.id}
        members={members}
        invitations={pending}
      />
    </AppShell>
  );
}
