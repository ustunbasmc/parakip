import Link from "next/link";
import { getAdminDbClient } from "@/lib/admin/auth";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_ADMIN_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  formatSupportDate,
  formatTicketNumber,
  isTicketStatus,
  isTicketType,
} from "@/lib/support/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_TONE: Record<string, string> = {
  urgent: "text-danger",
  high: "text-warning",
  normal: "text-text-secondary",
  low: "text-text-muted",
};

/** Admin layout zaten platform admin kontrolü yapar (bkz. admin/layout.tsx). */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const status = isTicketStatus(params.status) ? params.status : params.status === "all" ? "all" : "active";
  const type = isTicketType(params.type) ? params.type : "";
  const from = params.from && DATE_RE.test(params.from) ? params.from : "";
  const to = params.to && DATE_RE.test(params.to) ? params.to : "";

  const supabase = getAdminDbClient();
  let query = supabase
    .from("support_tickets")
    .select("id, ticket_number, user_id, type, subject, status, priority, space_type, created_at, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(200);

  if (status === "active") query = query.in("status", ["open", "in_review", "awaiting_user"]);
  else if (status !== "all") query = query.eq("status", status);
  if (type) query = query.eq("type", type);
  // Tarihler Türkiye saatine göre gün başı/sonu olarak yorumlanır.
  if (from) query = query.gte("created_at", `${from}T00:00:00+03:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999+03:00`);

  const { data: tickets, error } = await query;

  const userIds = [...new Set((tickets ?? []).map((t) => t.user_id))];
  const { data: profiles } =
    userIds.length > 0 ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds) : { data: [] };
  const nameByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const selectClass = "h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-extrabold text-text-primary">Destek Talepleri</h1>
        <p className="mt-1 text-sm text-text-muted">Öncelik talep türüne göre sistem tarafından atanır.</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Durum
          <select name="status" defaultValue={status} className={selectClass}>
            <option value="active">Bekleyenler (açık/inceleniyor/kullanıcı)</option>
            <option value="all">Tümü</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TICKET_STATUS_ADMIN_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Tür
          <select name="type" defaultValue={type} className={selectClass}>
            <option value="">Tümü</option>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TICKET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Başlangıç
          <input type="date" name="from" defaultValue={from} className={selectClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
          Bitiş
          <input type="date" name="to" defaultValue={to} className={selectClass} />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-accent px-4 text-sm font-bold text-text-on-accent">
          Filtrele
        </button>
        <Link href="/admin/support" className="h-10 px-2 text-sm font-semibold leading-10 text-text-muted">
          Temizle
        </Link>
      </form>

      {error ? (
        <p className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm text-danger">Talepler yüklenemedi: {error.message}</p>
      ) : !tickets || tickets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-6 text-center text-sm text-text-muted">
          Bu filtreye uyan talep yok.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">{tickets.length} talep</p>
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-4 hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-muted">
                  {formatTicketNumber(t.ticket_number)} · {isTicketType(t.type) ? TICKET_TYPE_LABELS[t.type] : t.type} ·{" "}
                  {nameByUserId.get(t.user_id) || "İsimsiz"}
                  {t.space_type ? ` · ${t.space_type === "home" ? "Ev" : "İşletme"}` : ""}
                </p>
                <p className="truncate text-sm font-semibold text-text-primary">{t.subject}</p>
                <p className="text-xs text-text-muted">
                  Oluşturma: {formatSupportDate(t.created_at)} · Son hareket: {formatSupportDate(t.last_message_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`text-xs font-bold ${PRIORITY_TONE[t.priority] ?? ""}`}>
                  {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority}
                </span>
                <TicketStatusBadge status={t.status} admin />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
