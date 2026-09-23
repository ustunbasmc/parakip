import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { getMyPendingInvitations, ROLE_LABELS } from "@/lib/api/members-rpc";

export const metadata = { title: "Davetlerim | Parakip" };

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });

/** Giriş yapan kişinin e-postasına gelmiş bekleyen alan davetleri (bildirimden gelinir). */
export default async function InvitationsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const invitations = await getMyPendingInvitations(supabase).catch(() => []);

  return (
    <AppShell variant="subpage" title="Davetlerim" parentHref="/home">
      <div className="flex flex-col gap-3 pt-3 pb-6">
        {invitations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">
            Bekleyen davetin yok.
          </p>
        ) : (
          invitations.map((inv) => (
            <Link
              key={inv.invitationId}
              href={`/invite/${inv.token}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-muted"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-text-primary">{inv.spaceName}</span>
                <span className="block truncate text-xs text-text-muted">
                  {inv.inviterName} · {ROLE_LABELS[inv.role]} · {dateFmt.format(new Date(inv.expiresAt))} tarihine kadar
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-accent">Görüntüle →</span>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
