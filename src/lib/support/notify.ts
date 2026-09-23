import "server-only";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, siteUrl } from "@/lib/email/layout";
import { TICKET_TYPE_LABELS, formatTicketNumber, type TicketType } from "./constants";

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

  const mail = renderEmail({
    preheader: `${TICKET_TYPE_LABELS[ticket.type]} · ${ticket.subject}`,
    heading: `Yeni destek talebi: ${formatTicketNumber(ticket.ticketNumber)}`,
    paragraphs: [`Tür: ${TICKET_TYPE_LABELS[ticket.type]}`, `Öncelik: ${ticket.priority}`, `Konu: ${ticket.subject}`],
    button: { label: "Admin panelinde aç", url: `${siteUrl()}/admin/support/${ticket.id}` },
  });
  return sendEmail({
    to,
    subject: `[Parakip Destek] ${formatTicketNumber(ticket.ticketNumber)} ${TICKET_TYPE_LABELS[ticket.type]}: ${ticket.subject}`,
    ...mail,
  });
}

/** Kullanıcı mevcut talebine yeni mesaj yazdığında destek ekibine bildirim. */
export async function notifySupportTeamUserReply(ticket: { id: string; ticketNumber: number; subject: string }) {
  const to = process.env.SUPPORT_EMAIL;
  if (!to) return { sent: false, reason: "no_support_email" };

  const mail = renderEmail({
    heading: `${formatTicketNumber(ticket.ticketNumber)} numaralı talebe yeni mesaj`,
    paragraphs: ["Kullanıcı mevcut talebine yeni bir mesaj yazdı.", `Konu: ${ticket.subject}`],
    button: { label: "Admin panelinde aç", url: `${siteUrl()}/admin/support/${ticket.id}` },
  });
  return sendEmail({
    to,
    subject: `[Parakip Destek] ${formatTicketNumber(ticket.ticketNumber)} yeni kullanıcı mesajı`,
    ...mail,
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
  const mail = renderEmail({
    preheader: "Destek ekibimiz talebine yanıt verdi.",
    heading: "Destek talebin yanıtlandı",
    paragraphs: [
      `"${params.subject}" konulu destek talebine (${formatTicketNumber(params.ticketNumber)}) yanıt verdik.`,
      "Güvenliğin için yanıtın içeriğini e-postaya eklemiyoruz; uygulamada okuyabilirsin.",
    ],
    button: { label: "Yanıtı oku", url: `${siteUrl()}/support/tickets/${params.ticketId}` },
  });
  return sendEmail({
    to: params.to,
    replyTo: process.env.SUPPORT_EMAIL || undefined,
    subject: `Destek talebin yanıtlandı (${formatTicketNumber(params.ticketNumber)})`,
    ...mail,
  });
}
