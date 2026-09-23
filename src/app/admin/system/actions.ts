"use server";

import { getCurrentUserAndAdminStatus, logAdminAction } from "@/lib/admin/auth";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, siteUrl } from "@/lib/email/layout";

const REASONS: Record<string, string> = {
  not_configured: "RESEND_API_KEY veya SUPPORT_EMAIL_FROM tanımlı değil.",
  no_recipient: "Admin hesabının e-posta adresi bulunamadı.",
  network: "Resend'e ulaşılamadı (ağ hatası).",
  http_401: "Resend API anahtarı geçersiz.",
  http_403: "Gönderen alan adı Resend'de doğrulanmamış ya da bu adrese gönderim izni yok.",
  http_422: "Gönderen adresi (SUPPORT_EMAIL_FROM) geçersiz veya doğrulanmış alan adına ait değil.",
  http_429: "Resend gönderim sınırına takıldı; biraz sonra tekrar dene.",
};

/** Yapılandırmayı doğrulamak için admin'in kendi adresine test e-postası. */
export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) return { ok: false, message: "Yetkisiz." };
  if (!user.email) return { ok: false, message: REASONS.no_recipient };

  const mail = renderEmail({
    preheader: "E-posta ayarların çalışıyor.",
    heading: "Test e-postası",
    paragraphs: [
      "Bu e-postayı görüyorsan Parakip'in e-posta gönderimi (Resend) doğru yapılandırılmış demektir.",
      `Gönderim adresi: ${process.env.SUPPORT_EMAIL_FROM ?? "—"}`,
    ],
    button: { label: "Parakip'i aç", url: siteUrl() },
  });
  const result = await sendEmail({ to: user.email, subject: "Parakip test e-postası", ...mail });

  await logAdminAction({
    adminUserId: user.id,
    action: "email_test",
    entityType: "user",
    entityId: user.id,
    detail: { sent: result.sent, reason: result.reason ?? null },
  });

  return result.sent
    ? { ok: true, message: `${user.email} adresine test e-postası gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.` }
    : { ok: false, message: REASONS[result.reason ?? ""] ?? `Gönderilemedi (${result.reason ?? "bilinmeyen hata"}).` };
}
