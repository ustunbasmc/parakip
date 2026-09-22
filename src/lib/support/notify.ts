import "server-only";
import { sendEmail } from "@/lib/email/send";
import { TICKET_TYPE_LABELS, formatTicketNumber, type TicketType } from "./constants";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
}

/**
 * Yeni destek talebinde destek ekibine bildirim. Alıcı SUPPORT_EMAIL
 * ortam değişkeninden okunur — kod içine sabit adres YAZILMAZ.
 *
 * Gizlilik: e-postaya yalnızca talep türü, numarası ve konusu yazılır;
 * açıklama/ekran görüntüsü gibi içerik e-postaya KONMAZ, admin panelinden
 * okunur.
 */
export async function notifySupportTeamNewTicket(ticket: {
  id: string;
  ticketNumber: number;
  type: TicketType;
  subject: string;
  priority: string;
}) {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) return { sent: false, reason: "no_support_email" };

  return sendEmail({
    to,
    subject: `[Parakip Destek] ${formatTicketNumber(ticket.ticketNumber)} ${TICKET_TYPE_LABELS[ticket.type]}: ${ticket.subject}`,
    text: [
      `Yeni destek talebi: ${formatTicketNumber(ticket.ticketNumber)}`,
      `Tür: ${TICKET_TYPE_LABELS[ticket.type]}`,
      `Öncelik: ${ticket.priority}`,
      `Konu: ${ticket.subject}`,
      "",
      `Admin panelinde görüntüle: ${siteUrl()}/admin/support/${ticket.id}`,
    ].join("\n"),
  });
}

/** Kullanıcı mevcut talebine yeni mesaj yazdığında destek ekibine bildirim. */
export async function notifySupportTeamUserReply(ticket: { id: string; ticketNumber: number; subject: string }) {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) return { sent: false, reason: "no_support_email" };

  return sendEmail({
    to,
    subject: `[Parakip Destek] ${formatTicketNumber(ticket.ticketNumber)} yeni kullanıcı mesajı`,
    text: [
      `${formatTicketNumber(ticket.ticketNumber)} numaralı talebe kullanıcı yeni bir mesaj yazdı.`,
      `Konu: ${ticket.subject}`,
      "",
      `Admin panelinde görüntüle: ${siteUrl()}/admin/support/${ticket.id}`,
    ].join("\n"),
  });
}

/**
 * Admin yanıt verdiğinde kullanıcıya bildirim. Yanıt metni e-postaya
 * KONMAZ — kullanıcı uygulamaya girip okur (e-posta kanalında hassas
 * içerik dolaşmasın diye).
 */
export async function notifyUserAdminReplied(params: {
  to: string;
  ticketId: string;
  ticketNumber: number;
  subject: string;
}) {
  return sendEmail({
    to: params.to,
    replyTo: process.env.SUPPORT_EMAIL || undefined,
    subject: `Destek talebin yanıtlandı (${formatTicketNumber(params.ticketNumber)})`,
    text: [
      "Merhaba,",
      "",
      `"${params.subject}" konulu destek talebine yanıt verdik.`,
      "Yanıtı okumak için uygulamaya giriş yapabilirsin:",
      `${siteUrl()}/support/tickets/${params.ticketId}`,
      "",
      "Parakip Destek",
    ].join("\n"),
  });
}
