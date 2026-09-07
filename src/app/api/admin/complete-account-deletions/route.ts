import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Hesap silme taleplerini GÜVENLİ şekilde tamamlar. Bu endpoint
 * `/api/cron/run-notifications` ile AYNI güvenlik desenini izler:
 * `ADMIN_SECRET` olmadan çağrılamaz (401 döner).
 *
 * NEDEN OTOMATİK/ANINDA DEĞİL: `deletion_requested_at` dolduğu AN hesabı
 * silmek yerine, en az `ACCOUNT_DELETION_GRACE_DAYS` (varsayılan 7) gün
 * beklenir — kullanıcı fikrini değiştirip talebi iptal edebilsin diye
 * (mevcut "Talebi iptal et" akışı zaten var, bkz. AccountManagementView).
 * Bu endpoint günde bir kez (ör. aynı Vercel Cron/harici zamanlayıcı ile,
 * /api/cron/run-notifications gibi) çağrılmalıdır.
 *
 * NE YAPAR (KVKK/veri temizliği amaçlı, finansal geçmişi KORUYARAK):
 *  1. auth.users.email → anonim bir değere değiştirilir (Admin API)
 *  2. Hesap banlanır (artık giriş yapılamaz)
 *  3. profiles'daki kişisel alanlar temizlenir
 *  4. deletion_completed_at işaretlenir
 * auth.users SATIRI SİLİNMEZ, spaces/accounts/transactions/debts HİÇ
 * DOKUNULMAZ (bkz. migration 0057'deki gerekçe).
 */
export async function POST(request: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_SECRET tanımlı değil." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

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

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const row of candidates ?? []) {
    const userId = row.user_id as string;
    try {
      const anonymizedEmail = `deleted-${userId}@parakip.local`;

      const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
        email: anonymizedEmail,
        ban_duration: "876000h", // ~100 yıl — kalıcı olarak giriş engellenir
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: null,
          last_name: null,
          phone: null,
          avatar_url: null,
          deletion_completed_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (profileError) throw profileError;

      results.push({ userId, ok: true });
    } catch (err) {
      results.push({ userId, ok: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
