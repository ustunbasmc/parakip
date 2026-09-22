import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { TICKET_TYPE_LABELS, formatSupportDate, formatTicketNumber, isTicketType } from "@/lib/support/constants";

export const metadata = { title: "Destek Taleplerim | Parakip" };

export default async function MyTicketsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  // RLS: yalnızca kullanıcının KENDİ talepleri döner. user_id filtresi
  // ayrıca savunma derinliği olarak eklenir.
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, type, subject, status, last_message_at, last_admin_reply_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(100);

  return (
    <AppShell variant="subpage" title="Destek Taleplerim" backFallbackHref="/help">
      <div className="flex min-w-0 flex-col gap-3 pb-4 pt-3">
        <Link
          href="/support/new"
          className="flex h-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-text-on-accent"
        >
          Yeni destek talebi
        </Link>

        {error ? (
          <p role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
            Talepler yüklenemedi. Lütfen sayfayı yenile.
          </p>
        ) : !tickets || tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-6 text-center">
            <p className="text-sm font-semibold text-text-primary">Henüz destek talebin yok</p>
            <p className="mt-1 text-xs text-text-muted">
              Bir sorunla karşılaşırsan önce{" "}
              <Link href="/help" className="font-semibold text-accent">
                Yardım Merkezi
              </Link>
              &apos;ne göz at; çözüm bulamazsan bize yaz.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/support/tickets/${t.id}`}
                  className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
                >
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-text-muted">
                      {formatTicketNumber(t.ticket_number)} · {isTicketType(t.type) ? TICKET_TYPE_LABELS[t.type] : t.type}
                    </span>
                    <TicketStatusBadge status={t.status} />
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold text-text-primary">{t.subject}</span>
                  <span className="text-xs text-text-muted">Son hareket: {formatSupportDate(t.last_message_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
