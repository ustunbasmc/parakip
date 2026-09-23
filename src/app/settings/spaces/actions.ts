"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { ROLE_LABELS, type MemberRole } from "@/lib/api/members-rpc";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function siteOrigin() {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

/**
 * Davet e-postası (Resend yapılandırılmışsa). Davet satırı kullanıcının
 * KENDİ oturumuyla okunur — RLS yalnızca alanın sahip/yöneticisine izin
 * verir; yani başkasının davetine e-posta tetiklenemez. E-posta
 * gönderilemezse davet yine geçerlidir (bağlantı elle paylaşılabilir).
 */
export async function sendSpaceInvitationEmail(invitationId: string): Promise<{ sent: boolean }> {
  if (!UUID_RE.test(invitationId)) return { sent: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) return { sent: false };

  const { data: inv } = await supabase
    .from("space_invitations")
    .select("email, role, token, status, spaces(name)")
    .eq("id", invitationId)
    .maybeSingle();
  if (!inv || inv.status !== "pending") return { sent: false };

  const space = Array.isArray(inv.spaces) ? inv.spaces[0] : inv.spaces;
  const { data: profile } = await supabase.from("profiles").select("first_name, last_name, display_name").eq("user_id", user.id).maybeSingle();
  const inviter = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || profile?.display_name || user.email || "Bir Parakip kullanıcısı";
  const origin = await siteOrigin();
  if (!origin) return { sent: false };

  const spaceName = space?.name ?? "bir alan";
  const mail = renderEmail({
    preheader: `${inviter} seni "${spaceName}" alanına davet etti.`,
    heading: `"${spaceName}" alanına davet edildin`,
    paragraphs: [
      `${inviter} seni Parakip'teki "${spaceName}" alanına ${ROLE_LABELS[inv.role as MemberRole] ?? inv.role} olarak davet etti.`,
      "Parakip hesabın yoksa bu e-posta adresiyle ücretsiz kayıt olup daveti kabul edebilirsin.",
    ],
    button: { label: "Daveti görüntüle", url: `${origin}/invite/${inv.token}` },
    note: "Bu davet 7 gün geçerlidir. Beklemediğin bir davetse bu e-postayı yok sayabilirsin.",
  });
  const result = await sendEmail({
    to: inv.email,
    subject: `${inviter} seni Parakip'te "${spaceName}" alanına davet etti`,
    ...mail,
  });
  return { sent: result.sent };
}
