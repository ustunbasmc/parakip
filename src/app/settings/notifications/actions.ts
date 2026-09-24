"use server";

import { createClient, getSessionUser } from "@/lib/supabase/server";
import { sendTestPush } from "@/lib/push/send";

/** Yalnızca oturumdaki kullanıcının kendi cihazlarına deneme bildirimi. */
export async function sendTestPushAction(): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { ok: false, message: "Oturum bulunamadı." };
  try {
    const r = await sendTestPush(user.id);
    if (r.devices === 0) return { ok: false, message: "Bu hesapta kayıtlı cihaz yok." };
    if (r.sent === 0) return { ok: false, message: "Bildirim gönderilemedi. Tarayıcı izinlerini kontrol et." };
    return { ok: true, message: `Deneme bildirimi ${r.sent} cihaza gönderildi.` };
  } catch {
    return { ok: false, message: "Bildirim gönderilemedi. Lütfen tekrar dene." };
  }
}
