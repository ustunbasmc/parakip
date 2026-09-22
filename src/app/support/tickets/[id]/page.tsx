import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { MessageThread, type ThreadMessage } from "@/components/support/MessageThread";
import { SupportReplyForm } from "@/components/support/SupportReplyForm";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import {
  SUPPORT_BUCKET,
  TICKET_TYPE_LABELS,
  formatSupportDate,
  formatTicketNumber,
  isTicketType,
  screenLabel,
} from "@/lib/support/constants";

export const metadata = { title: "Destek talebi | Parakip" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  // RLS: başka kullanıcıya ait talep null döner → 404 (varlığı sızdırılmaz).
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, type, subject, description, screen, status, created_at, help_articles(slug, title)")
    .eq("id", id)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: messages }, { data: attachments }] = await Promise.all([
    // RLS iç notları (is_internal) kullanıcıya hiç döndürmez.
    supabase
      .from("support_messages")
      .select("id, author_role, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    supabase.from("support_attachments").select("id, storage_path").eq("ticket_id", ticket.id),
  ]);

  // Görseller private bucket'ta — 10 dakikalık imzalı URL üretilir.
  let imageUrls: { id: string; url: string }[] = [];
  if (attachments && attachments.length > 0) {
    const { data: signed } = await supabase.storage
      .from(SUPPORT_BUCKET)
      .createSignedUrls(attachments.map((a) => a.storage_path), 600);
    imageUrls = (signed ?? [])
      .map((s, i) => (s.signedUrl ? { id: attachments[i].id, url: s.signedUrl } : null))
      .filter((x): x is { id: string; url: string } => x !== null);
  }

  const article = Array.isArray(ticket.help_articles) ? ticket.help_articles[0] : ticket.help_articles;

  const thread: ThreadMessage[] = [
    { id: "initial", authorRole: "user", body: ticket.description, createdAt: ticket.created_at },
    ...(messages ?? []).map((m) => ({
      id: m.id,
      authorRole: m.author_role as "user" | "admin",
      body: m.body,
      createdAt: m.created_at,
    })),
  ];

  const closed = ticket.status === "closed";

  return (
    <AppShell variant="subpage" title={formatTicketNumber(ticket.ticket_number)} parentHref="/support/tickets">
      <div className="flex min-w-0 flex-col gap-4 pb-4 pt-3">
        <header className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-text-muted">
              {isTicketType(ticket.type) ? TICKET_TYPE_LABELS[ticket.type] : ticket.type}
            </span>
            <TicketStatusBadge status={ticket.status} />
          </div>
          <h1 className="mt-1.5 break-words text-base font-bold text-text-primary">{ticket.subject}</h1>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-text-muted">Oluşturma</dt>
            <dd className="text-text-secondary">{formatSupportDate(ticket.created_at)}</dd>
            <dt className="text-text-muted">Ekran</dt>
            <dd className="text-text-secondary">{screenLabel(ticket.screen)}</dd>
            {article ? (
              <>
                <dt className="text-text-muted">Makale</dt>
                <dd className="min-w-0 truncate">
                  <Link href={`/help/${article.slug}`} className="font-semibold text-accent">
                    {article.title}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
        </header>

        {ticket.status === "awaiting_user" ? (
          <p role="status" className="rounded-2xl bg-warning-soft p-3.5 text-sm font-semibold text-warning">
            Ekibimiz senden bir yanıt bekliyor. Aşağıdan mesaj yazabilirsin.
          </p>
        ) : null}

        <MessageThread messages={thread} perspective="user" />

        {imageUrls.length > 0 ? (
          <section aria-label="Ekran görüntüleri" className="flex flex-wrap gap-2">
            {imageUrls.map((img) => (
              <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Eklenen ekran görüntüsü" className="h-24 w-24 object-cover" />
              </a>
            ))}
          </section>
        ) : null}

        {closed ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-4 text-center text-sm text-text-muted">
            Bu talep kapatıldı.{" "}
            <Link href="/support/new" className="font-semibold text-accent">
              Yeni talep oluştur
            </Link>
          </div>
        ) : (
          <SupportReplyForm ticketId={ticket.id} />
        )}

        <p className="text-center text-xs text-text-muted">Yeni yanıtları görmek için sayfayı yenileyebilirsin.</p>
      </div>
    </AppShell>
  );
}
