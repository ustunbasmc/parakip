"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";
import { MESSAGE_MAX, isTicketStatus, type TicketStatus } from "@/lib/support/constants";
import { notifyUserAdminReplied } from "@/lib/support/notify";

/**
 * Server Action'lar middleware'DEN ve admin layout'undan GEÇMEZ — HER
 * action kendi İÇİNDE admin doğrulaması YAPMAK ZORUNDADIR (bkz.
 * payments/actions.ts'teki AYNI uyarı).
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) throw new Error("Yetkisiz.");
  return user;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = { ok: true } | { ok: false; error: string };

/**
 * Yanıt veya iç not ekler. Yanıtta (iç not DEĞİLSE) talep durumu
 * `nextStatus` (varsayılan 'answered') olur ve kullanıcıya e-posta
 * bildirimi gönderilir. E-posta başarısız olsa bile yanıt kaydedilmiş
 * sayılır.
 */
export async function adminReplyToTicket(input: {
  ticketId: string;
  body: string;
  internal: boolean;
  nextStatus?: string;
  clientRequestId: string;
}): Promise<Result> {
  const admin = await assertAdmin();
  const supabase = getAdminDbClient();

  const body = (input.body ?? "").trim();
  if (!UUID_RE.test(input.ticketId) || !UUID_RE.test(input.clientRequestId)) return { ok: false, error: "Geçersiz istek." };
  if (!body) return { ok: false, error: "Mesaj boş olamaz." };
  if (body.length > MESSAGE_MAX) return { ok: false, error: `En fazla ${MESSAGE_MAX} karakter.` };

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, user_id, ticket_number, subject, status")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Talep bulunamadı." };

  const { error: msgError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_user_id: admin.id,
    author_role: "admin",
    body,
    is_internal: input.internal,
    client_request_id: input.clientRequestId,
  });
  if (msgError) {
    if (msgError.code === "23505") return { ok: true }; // aynı gönderim zaten kaydedildi
    return { ok: false, error: msgError.message };
  }

  await supabase.from("support_ticket_events").insert({
    ticket_id: ticket.id,
    actor_user_id: admin.id,
    actor_role: "admin",
    event: input.internal ? "internal_note" : "admin_replied",
  });

  if (!input.internal) {
    const nextStatus: TicketStatus = isTicketStatus(input.nextStatus) ? input.nextStatus : "answered";
    const now = new Date().toISOString();
    await supabase
      .from("support_tickets")
      .update({ status: nextStatus, last_message_at: now, last_admin_reply_at: now })
      .eq("id", ticket.id);

    after(async () => {
      const { data } = await supabase.auth.admin.getUserById(ticket.user_id);
      const email = data?.user?.email;
      if (email) {
        await notifyUserAdminReplied({
          to: email,
          ticketId: ticket.id,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
        });
      }
    });
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: input.internal ? "support_internal_note" : "support_reply",
    entityType: "support_ticket",
    entityId: ticket.id,
  });

  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function adminSetTicketStatus(ticketId: string, status: string): Promise<Result> {
  const admin = await assertAdmin();
  if (!UUID_RE.test(ticketId) || !isTicketStatus(status)) return { ok: false, error: "Geçersiz istek." };
  const supabase = getAdminDbClient();

  const { data: before } = await supabase.from("support_tickets").select("status").eq("id", ticketId).maybeSingle();
  if (!before) return { ok: false, error: "Talep bulunamadı." };
  if (before.status === status) return { ok: true };

  // Olay kaydı (status_changed) veritabanı trigger'ı tarafından yazılır.
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    adminUserId: admin.id,
    action: "support_status_change",
    entityType: "support_ticket",
    entityId: ticketId,
    detail: { from: before.status, to: status },
  });

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function adminLinkArticle(ticketId: string, articleId: string | null): Promise<Result> {
  const admin = await assertAdmin();
  if (!UUID_RE.test(ticketId) || (articleId !== null && !UUID_RE.test(articleId))) return { ok: false, error: "Geçersiz istek." };
  const supabase = getAdminDbClient();

  const { error } = await supabase.from("support_tickets").update({ related_article_id: articleId }).eq("id", ticketId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("support_ticket_events").insert({
    ticket_id: ticketId,
    actor_user_id: admin.id,
    actor_role: "admin",
    event: "article_linked",
    detail: { article_id: articleId },
  });
  await logAdminAction({
    adminUserId: admin.id,
    action: "support_link_article",
    entityType: "support_ticket",
    entityId: ticketId,
    detail: { articleId },
  });

  revalidatePath(`/admin/support/${ticketId}`);
  return { ok: true };
}
