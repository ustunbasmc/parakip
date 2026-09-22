import {
  TICKET_STATUS_ADMIN_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONE,
  isTicketStatus,
} from "@/lib/support/constants";

export function TicketStatusBadge({ status, admin = false }: { status: string; admin?: boolean }) {
  if (!isTicketStatus(status)) return null;
  const label = admin ? TICKET_STATUS_ADMIN_LABELS[status] : TICKET_STATUS_LABELS[status];
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${TICKET_STATUS_TONE[status]}`}>
      {label}
    </span>
  );
}
