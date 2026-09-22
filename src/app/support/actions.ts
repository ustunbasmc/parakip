"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ATTACHMENT_TYPES,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  MAX_ATTACHMENT_BYTES,
  MESSAGE_MAX,
  SCREEN_OPTIONS,
  SUBJECT_MAX,
  SUBJECT_MIN,
  isTicketType,
} from "@/lib/support/constants";
import { notifySupportTeamNewTicket, notifySupportTeamUserReply } from "@/lib/support/notify";

/**
 * Kullanıcı tarafı destek işlemleri. HER ŞEY RLS'e tabi normal client ile
 * yapılır (service_role KULLANILMAZ) — kullanıcı yalnızca kendi adına
 * talep/mesaj oluşturabilir, başkasının talebine yazamaz (bkz. migration
 * 0061 politikaları). Server Action'lar doğrudan POST ile çağrılabildiği
 * için her fonksiyon oturumu KENDİSİ doğrular.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = "23505";

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  return { supabase, user };
}

/** İstemciden gelen teknik bağlamı yalnızca bilinen, kısa alanlara indirger — serbest veri kabul edilmez. */
function sanitizeClientContext(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.userAgent === "string") out.userAgent = r.userAgent.slice(0, 300);
  if (typeof r.viewport === "string") out.viewport = r.viewport.slice(0, 20);
  if (typeof r.language === "string") out.language = r.language.slice(0, 20);
  if (typeof r.standalone === "boolean") out.standalone = r.standalone;
  return out;
}

export interface CreateTicketInput {
  clientRequestId: string;
  type: string;
  subject: string;
  description: string;
  screen: string;
  spaceType: string | null;
  relatedArticleSlug: string | null;
  attachment: { path: string; mimeType: string; size: number } | null;
  clientContext: unknown;
}

export async function createSupportTicket(
  input: CreateTicketInput
): Promise<ActionResult<{ ticketId: string; attachmentFailed: boolean }>> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };

  const subject = (input.subject ?? "").trim();
  const description = (input.description ?? "").trim();

  if (!UUID_RE.test(input.clientRequestId ?? "")) return { ok: false, error: "Geçersiz istek. Sayfayı yenileyip tekrar dene." };
  if (!isTicketType(input.type)) return { ok: false, error: "Lütfen bir talep türü seç." };
  if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX)
    return { ok: false, error: `Konu ${SUBJECT_MIN}-${SUBJECT_MAX} karakter olmalı.` };
  if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    return { ok: false, error: `Açıklama en az ${DESCRIPTION_MIN}, en fazla ${DESCRIPTION_MAX} karakter olmalı.` };

  const screen = SCREEN_OPTIONS.some((o) => o.value === input.screen) ? input.screen : null;
  const spaceType = input.spaceType === "home" || input.spaceType === "business" ? input.spaceType : null;

  // İlgili makale yalnızca YAYINLANMIŞ ise bağlanır (RLS zaten taslakları gizler).
  let relatedArticleId: string | null = null;
  if (input.relatedArticleSlug && /^[a-z0-9-]{1,120}$/.test(input.relatedArticleSlug)) {
    const { data: article } = await supabase
      .from("help_articles")
      .select("id")
      .eq("slug", input.relatedArticleSlug)
      .maybeSingle();
    relatedArticleId = article?.id ?? null;
  }

  const appContext = {
    ...sanitizeClientContext(input.clientContext),
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      type: input.type,
      subject,
      description,
      screen,
      space_type: spaceType,
      related_article_id: relatedArticleId,
      app_context: appContext,
      client_request_id: input.clientRequestId,
    })
    .select("id, ticket_number, type, subject, priority")
    .single();

  if (error) {
    // Çift tıklama / ağ yeniden denemesi: aynı client_request_id zaten
    // kaydedilmişse YENİ talep oluşturulmaz, mevcut talep döndürülür.
    if (error.code === UNIQUE_VIOLATION) {
      const { data: existing } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("client_request_id", input.clientRequestId)
        .maybeSingle();
      if (existing) return { ok: true, ticketId: existing.id, attachmentFailed: false };
    }
    return { ok: false, error: "Talebin gönderilemedi. Lütfen tekrar dene." };
  }

  // Ekran görüntüsü: dosya istemciden DOĞRUDAN kullanıcının kendi Storage
  // klasörüne yüklenir; burada yalnızca yol doğrulanıp kayda bağlanır.
  // Başarısız olursa talep YİNE DE kaydedilmiş sayılır.
  let attachmentFailed = false;
  if (input.attachment) {
    const a = input.attachment;
    const expectedPrefix = `${user.id}/${input.clientRequestId}/`;
    const valid =
      typeof a.path === "string" &&
      a.path.startsWith(expectedPrefix) &&
      !a.path.includes("..") &&
      Boolean(ATTACHMENT_TYPES[a.mimeType]) &&
      Number.isInteger(a.size) &&
      a.size > 0 &&
      a.size <= MAX_ATTACHMENT_BYTES;

    if (valid) {
      const { error: attachError } = await supabase.from("support_attachments").insert({
        ticket_id: ticket.id,
        uploaded_by: user.id,
        storage_path: a.path,
        mime_type: a.mimeType,
        size_bytes: a.size,
      });
      attachmentFailed = Boolean(attachError);
    } else {
      attachmentFailed = true;
    }
  }

  after(async () => {
    await notifySupportTeamNewTicket({
      id: ticket.id,
      ticketNumber: ticket.ticket_number,
      type: ticket.type,
      subject: ticket.subject,
      priority: ticket.priority,
    });
  });

  revalidatePath("/support/tickets");
  return { ok: true, ticketId: ticket.id, attachmentFailed };
}

export async function addSupportMessage(input: {
  ticketId: string;
  body: string;
  clientRequestId: string;
}): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };

  const body = (input.body ?? "").trim();
  if (!UUID_RE.test(input.ticketId ?? "") || !UUID_RE.test(input.clientRequestId ?? ""))
    return { ok: false, error: "Geçersiz istek." };
  if (body.length < 1) return { ok: false, error: "Mesaj boş olamaz." };
  if (body.length > MESSAGE_MAX) return { ok: false, error: `Mesaj en fazla ${MESSAGE_MAX} karakter olabilir.` };

  // RLS: yalnızca kendi talebi görünür — başkasının talebi "bulunamadı" olur.
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject, status")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Talep bulunamadı." };
  if (ticket.status === "closed")
    return { ok: false, error: "Bu talep kapatıldı. Yeni bir sorun için yeni talep oluşturabilirsin." };

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_user_id: user.id,
    author_role: "user",
    body,
    client_request_id: input.clientRequestId,
  });

  if (error && error.code !== UNIQUE_VIOLATION) {
    return { ok: false, error: "Mesajın gönderilemedi. Lütfen tekrar dene." };
  }

  if (!error) {
    after(async () => {
      await notifySupportTeamUserReply({ id: ticket.id, ticketNumber: ticket.ticket_number, subject: ticket.subject });
    });
  }

  revalidatePath(`/support/tickets/${ticket.id}`);
  revalidatePath("/support/tickets");
  return { ok: true };
}

export async function submitArticleFeedback(input: { articleId: string; helpful: boolean }): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş." };
  if (!UUID_RE.test(input.articleId ?? "") || typeof input.helpful !== "boolean")
    return { ok: false, error: "Geçersiz istek." };

  const { error } = await supabase
    .from("help_article_feedback")
    .upsert(
      { article_id: input.articleId, user_id: user.id, helpful: input.helpful },
      { onConflict: "article_id,user_id" }
    );
  if (error) return { ok: false, error: "Geri bildirimin kaydedilemedi." };
  return { ok: true };
}
