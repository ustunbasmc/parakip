import "server-only";
import { sendEmail } from "@/lib/email/send";
import { renderEmail, siteUrl } from "@/lib/email/layout";

const PLAN_LABELS: Record<string, string> = { home_premium: "Ev Premium", business: "İşletme Premium" };
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" });

/** Havale onaylandığında kullanıcıya bilgi. Hata fırlatmaz (bkz. sendEmail). */
export async function notifyPaymentApproved(params: { to: string; plan: string; periodEnd: string; spaceId: string }) {
  const plan = PLAN_LABELS[params.plan] ?? "Premium";
  const mail = renderEmail({
    preheader: `${plan} aboneliğin aktif.`,
    heading: `${plan} aboneliğin aktif`,
    paragraphs: [
      "Havale/EFT ödemeni doğruladık, teşekkür ederiz.",
      `${plan} aboneliğin ${dateFmt.format(new Date(params.periodEnd))} tarihine kadar geçerli. Abonelikler otomatik yenilenmez; süre bitmeden 7 gün önce sana hatırlatırız.`,
    ],
    button: { label: "Planımı görüntüle", url: `${siteUrl()}/settings/plan?space=${params.spaceId}` },
  });
  return sendEmail({ category: "billing", to: params.to, replyTo: process.env.SUPPORT_EMAIL || undefined, subject: `${plan} aboneliğin aktif`, ...mail });
}

/** Havale reddedildiğinde kullanıcıya bilgi (varsa admin notuyla). */
export async function notifyPaymentRejected(params: { to: string; plan: string; note: string | null; spaceId: string }) {
  const plan = PLAN_LABELS[params.plan] ?? "Premium";
  const mail = renderEmail({
    preheader: "Ödeme bildirimini doğrulayamadık.",
    heading: "Ödeme bildirimin onaylanamadı",
    paragraphs: [
      `${plan} için yaptığın havale/EFT bildirimini banka hareketlerinde eşleştiremedik.`,
      ...(params.note ? [`Not: ${params.note}`] : []),
      "Ödemeyi yaptıysan açıklamaya referans kodunu yazdığından emin ol ya da destek talebi oluştur; birlikte kontrol edelim.",
    ],
    button: { label: "Destek talebi oluştur", url: `${siteUrl()}/support/new` },
  });
  return sendEmail({ category: "billing", to: params.to, replyTo: process.env.SUPPORT_EMAIL || undefined, subject: "Ödeme bildirimin onaylanamadı", ...mail });
}
