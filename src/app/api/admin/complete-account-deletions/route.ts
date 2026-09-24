import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Bekleme süresi dolan hesap silme taleplerini tamamlar (günlük Vercel
 * Cron, bkz. vercel.json; elle çağrı için POST + ADMIN_SECRET).
 *
 * NE YAPAR (migration 0069 — KVKK):
 *  1. prepare_account_deletion(): kullanıcının TEK üyesi olduğu alanlar
 *     tüm kayıtlarıyla kalıcı silinir; ortak alanlarda sahiplik en
 *     kıdemli yöneticiye/üyeye devredilir; diğer üyelikleri kaldırılır.
 *  2. Profil fotoğrafı ve destek eki dosyaları depodan silinir.
 *  3. auth kullanıcısı Admin API ile silinir (profil, bildirim, destek
 *     talepleri vb. zincirleme silinir; havale kayıtları kişisiz saklanır).
 * Bir adım başarısız olursa ertesi gün yeniden denenir (1. adım tekrar
 * çalıştırılabilir).
 */
function bearer(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

/** Elle/harici zamanlayıcı ile çağrı — ADMIN_SECRET ister. */
export async function POST(request: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_SECRET tanımlı değil." }, { status: 500 });
  }
  const provided = bearer(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return completeDeletions();
}

/** Vercel Cron çağrısı — "Authorization: Bearer <CRON_SECRET>" ile GET. */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }
  const provided = bearer(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return completeDeletions();
}

/** Bir klasördeki tüm dosyaları (alt klasörler dahil) siler. */
async function removeFolder(supabase: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<number> {
  if (depth > 3) return 0;
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return 0;
  const files = data.filter((o) => o.id).map((o) => `${prefix}/${o.name}`);
  const folders = data.filter((o) => !o.id).map((o) => `${prefix}/${o.name}`);
  let removed = 0;
  if (files.length) {
    const { error: rmError } = await supabase.storage.from(bucket).remove(files);
    if (rmError) throw rmError;
    removed += files.length;
  }
  for (const f of folders) removed += await removeFolder(supabase, bucket, f, depth + 1);
  return removed;
}

async function completeDeletions() {
  const graceDays = Number(process.env.ACCOUNT_DELETION_GRACE_DAYS ?? "7");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - graceDays);

  const supabase = createServiceRoleClient();

  const { data: candidates, error: fetchError } = await supabase
    .from("profiles")
    .select("user_id")
    .not("deletion_requested_at", "is", null)
    .is("deletion_completed_at", null)
    .lte("deletion_requested_at", cutoff.toISOString());

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const results: { userId: string; ok: boolean; summary?: unknown; error?: string }[] = [];

  for (const row of candidates ?? []) {
    const userId = row.user_id as string;
    try {
      const { data: summary, error: prepError } = await supabase.rpc("prepare_account_deletion", { p_user_id: userId });
      if (prepError) throw prepError;

      await removeFolder(supabase, "avatars", userId);
      await removeFolder(supabase, "support-attachments", userId);

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      await supabase.from("account_deletions").update({ completed_at: new Date().toISOString() }).eq("user_id", userId);
      results.push({ userId, ok: true, summary });
    } catch (err) {
      results.push({ userId, ok: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
