import "server-only";

/**
 * Parakip işlemsel e-postaları için tek şablon. HTML (satır içi stil —
 * e-posta istemcileri harici CSS desteklemez) + düz metin yedeği üretir.
 * Tüm dinamik değerler kaçışlanır; kullanıcı girdisi HTML olarak yorumlanmaz.
 */

export interface EmailContent {
  /** Gelen kutusunda konu satırının yanında görünen kısa önizleme. */
  preheader?: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  /** Butonun altında, küçük gri not (ör. "Bu daveti beklemiyorsan…"). */
  note?: string;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://www.parakip.com").replace(/\/$/, "");
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#0d9488";

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const base = siteUrl();
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${esc(p)}</p>`)
    .join("");
  const button = content.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 8px;"><tr><td style="border-radius:12px;background:${BRAND};">
         <a href="${esc(content.button.url)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(content.button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 14px;font-size:12px;line-height:1.5;color:#94a3b8;">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:<br><span style="color:#64748b;word-break:break-all;">${esc(content.button.url)}</span></p>`
    : "";
  const note = content.note ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">${esc(content.note)}</p>` : "";

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(content.heading)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(content.preheader ?? content.heading)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 16px;">
      <a href="${esc(base)}" style="text-decoration:none;font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">
        <img src="${esc(base)}/brand/icon-192.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:7px;margin-right:8px;">parakip
      </a>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:18px;padding:28px 26px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;">${esc(content.heading)}</h1>
      ${paragraphs}${button}${note}
    </td></tr>
    <tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
      Bu e-posta Parakip hesabınla ilgili bir işlem nedeniyle gönderildi.<br>
      <a href="${esc(base)}" style="color:#64748b;">parakip.com</a> · Paran kontrolünde.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs.flatMap((p) => [p, ""]),
    ...(content.button ? [`${content.button.label}: ${content.button.url}`, ""] : []),
    ...(content.note ? [content.note, ""] : []),
    "Parakip · Paran kontrolünde.",
  ].join("\n");

  return { html, text };
}
