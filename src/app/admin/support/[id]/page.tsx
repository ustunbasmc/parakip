import Link from "next/link";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { notFound } from "next/navigation";
import { getAdminDbClient } from "@/lib/admin/auth";
import { MessageThread, type ThreadMessage } from "@/components/support/MessageThread";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { AdminTicketArticleLink, AdminTicketReply, AdminTicketStatus } from "@/components/admin/AdminTicketControls";
import {
  SUPPORT_BUCKET,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_ADMIN_LABELS,
  TICKET_TYPE_LABELS,
  formatSupportDate,
  formatTicketNumber,
  isTicketStatus,
  isTicketType,
  screenLabel,
} from "@/lib/support/constants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EVENT_LABELS: Record<string, string> = {
  created: "Talep oluşturuldu",
  user_replied: "Kullanıcı yanıt yazdı",
  admin_replied: "Admin yanıt verdi",
  internal_note: "İç not eklendi",
  status_changed: "Durum değişti",
  article_linked: "Makale bağlandı",
};

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = getAdminDbClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select(
      "id, ticket_number, user_id, type, subject, description, screen, status, priority, space_type, app_context, related_article_id, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: attachments }, { data: events }, { data: profile }, { data: articles }, authUser] =
    await Promise.all([
      supabase
        .from("support_messages")
        .select("id, author_role, body, is_internal, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true }),
      supabase.from("support_attachments").select("id, storage_path, size_bytes").eq("ticket_id", ticket.id),
      supabase
        .from("support_ticket_events")
        .select("id, event, from_status, to_status, actor_role, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("profiles").select("display_name").eq("user_id", ticket.user_id).maybeSingle(),
      supabase.from("help_articles").select("id, title").eq("status", "published").order("title"),
      supabase.auth.admin.getUserById(ticket.user_id),
    ]);

  let imageUrls: { id: string; url: string }[] = [];
  if (attachments && attachments.length > 0) {
    const { data: signed } = await supabase.storage
      .from(SUPPORT_BUCKET)
      .createSignedUrls(attachments.map((a) => a.storage_path), 600);
    imageUrls = (signed ?? [])
      .map((s, i) => (s.signedUrl ? { id: attachments[i].id, url: s.signedUrl } : null))
      .filter((x): x is { id: string; url: string } => x !== null);
  }

  const thread: ThreadMessage[] = [
    { id: "initial", authorRole: "user", body: ticket.description, createdAt: ticket.created_at },
    ...(messages ?? []).map((m) => ({
      id: m.id,
      authorRole: m.author_role as "user" | "admin",
      body: m.body,
      isInternal: m.is_internal,
      createdAt: m.created_at,
    })),
  ];

  const ctx = (ticket.app_context ?? {}) as Record<string, unknown>;
  const email = authUser.data?.user?.email ?? null;

  return (
    <div className="flex flex-col gap-5">
      <AdminBackLink href="/admin/support" label="Tüm talepler" />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-text-muted">
                {formatTicketNumber(ticket.ticket_number)} · {isTicketType(ticket.type) ? TICKET_TYPE_LABELS[ticket.type] : ticket.type}
              </p>
              <TicketStatusBadge status={ticket.status} admin />
            </div>
            <h1 className="mt-1 break-words text-lg font-extrabold text-text-primary">{ticket.subject}</h1>
          </div>

          <MessageThread messages={thread} perspective="admin" />

          {imageUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {imageUrls.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="Ekran görüntüsü" className="h-32 w-32 object-cover" />
                </a>
              ))}
            </div>
          ) : null}

          <AdminTicketReply ticketId={ticket.id} />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
            <AdminTicketStatus ticketId={ticket.id} status={ticket.status} />
            <AdminTicketArticleLink ticketId={ticket.id} currentArticleId={ticket.related_article_id} articles={articles ?? []} />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-2xl border border-border bg-surface p-4 text-xs">
            <dt className="text-text-muted">Kullanıcı</dt>
            <dd className="min-w-0 break-words text-text-primary">
              <Link href={`/admin/users/${ticket.user_id}`} className="font-semibold text-accent">
                {profile?.display_name || "İsimsiz"}
              </Link>
              {email ? <span className="block text-text-muted">{email}</span> : null}
            </dd>
            <dt className="text-text-muted">Öncelik</dt>
            <dd className="text-text-primary">{TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</dd>
            <dt className="text-text-muted">Alan türü</dt>
            <dd className="text-text-primary">
              {ticket.space_type === "home" ? "Ev" : ticket.space_type === "business" ? "İşletme" : "Belirtilmedi"}
            </dd>
            <dt className="text-text-muted">Ekran</dt>
            <dd className="text-text-primary">{screenLabel(ticket.screen)}</dd>
            <dt className="text-text-muted">Sürüm</dt>
            <dd className="text-text-primary">
              {String(ctx.appVersion ?? "—")} ({String(ctx.environment ?? "—")})
            </dd>
            <dt className="text-text-muted">Cihaz</dt>
            <dd className="min-w-0 break-words text-text-primary">
              {String(ctx.viewport ?? "—")}
              {ctx.standalone ? " · Uygulama (PWA)" : ""}
              {ctx.userAgent ? <span className="block text-text-muted">{String(ctx.userAgent)}</span> : null}
            </dd>
          </dl>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-muted">Geçmiş</p>
            <ol className="flex flex-col gap-1.5 text-xs">
              {(events ?? []).map((e) => (
                <li key={e.id} className="text-text-secondary">
                  <span className="text-text-muted">{formatSupportDate(e.created_at)}</span> · {EVENT_LABELS[e.event] ?? e.event}
                  {e.event === "status_changed" && isTicketStatus(e.to_status)
                    ? `: ${isTicketStatus(e.from_status) ? TICKET_STATUS_ADMIN_LABELS[e.from_status] : "—"} → ${TICKET_STATUS_ADMIN_LABELS[e.to_status]}`
                    : ""}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
