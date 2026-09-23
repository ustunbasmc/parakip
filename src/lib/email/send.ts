import "server-only";

/**
 * İşlemsel e-posta gönderimi. Projede Supabase Auth'un kendi e-postaları
 * DIŞINDA bir e-posta altyapısı yoktu; ek bir npm bağımlılığı eklememek
 * için Resend'in HTTP API'si doğrudan fetch ile çağrılır.
 *
 * YAPILANDIRILMAMIŞSA SESSİZCE ATLANIR: RESEND_API_KEY veya
 * SUPPORT_EMAIL_FROM tanımlı değilse hiçbir şey gönderilmez ve
 * { sent: false } döner. Bu fonksiyon ASLA hata FIRLATMAZ — e-posta
 * hatası, çağıran tarafın (ör. destek talebi kaydı) başarısını
 * etkilememelidir.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  /** Verilirse HTML gövde (bkz. lib/email/layout.ts); text her zaman yedek olarak gider. */
  html?: string;
  replyTo?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_EMAIL_FROM;

  if (!apiKey || !from) return { sent: false, reason: "not_configured" };
  if (!params.to) return { sent: false, reason: "no_recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[email] gönderilemedi:", res.status);
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] gönderim hatası:", err instanceof Error ? err.message : "bilinmeyen");
    return { sent: false, reason: "network" };
  }
}
