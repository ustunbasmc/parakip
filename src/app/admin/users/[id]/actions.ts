"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserAndAdminStatus, getAdminDbClient, logAdminAction } from "@/lib/admin/auth";

/**
 * Server Action'lar middleware'DEN GEÇMEZ ve /admin/layout.tsx'in
 * korumasına da TABİ DEĞİLDİR — bu yüzden HER action kendi İÇİNDE
 * admin doğrulaması YAPMAK ZORUNDADIR. Bu kontrol atlanırsa, herhangi
 * bir OTURUM AÇMIŞ kullanıcı bu action'ı doğrudan çağırıp TÜM
 * kullanıcı profillerini değiştirebilir.
 */
async function assertAdmin() {
  const { user, isAdmin } = await getCurrentUserAndAdminStatus();
  if (!user || !isAdmin) {
    throw new Error("Yetkisiz.");
  }
  return user;
}

export async function updateUserProfile(targetUserId: string, formData: FormData) {
  const admin = await assertAdmin();

  const firstName = (formData.get("firstName") as string)?.trim() || null;
  const lastName = (formData.get("lastName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const supabase = getAdminDbClient();
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, phone, display_name: displayName })
    .eq("user_id", targetUserId);

  if (error) throw new Error(error.message);

  await logAdminAction({
    adminUserId: admin.id,
    action: "update_profile",
    entityType: "profile",
    entityId: targetUserId,
    detail: { firstName, lastName, phone },
  });

  revalidatePath(`/admin/users/${targetUserId}`);
}

/**
 * "Silme" — proje genelindeki "finansal kayıtlar fiziksel olarak
 * silinmez" ilkesiyle TUTARLI: gerçek bir DELETE FROM transactions
 * YAPILMAZ, mevcut cancel_transaction RLS politikası/kuralı devre dışı
 * bırakılıp (service_role RLS'i zaten bypass eder) doğrudan
 * status='cancelled' güncellenir — bu, has_book_role gibi normal yetki
 * kontrollerini admin için BypAS eder ama audit/bakiye BÜTÜNLÜĞÜNÜ
 * KORUR (cancelled_at otomatik trigger ile ayarlanır, bkz. 0006).
 */
export async function cancelTransactionAsAdmin(transactionId: string, spaceIdForRevalidate: string) {
  const admin = await assertAdmin();

  const supabase = getAdminDbClient();
  const { error } = await supabase.from("transactions").update({ status: "cancelled" }).eq("id", transactionId);
  if (error) throw new Error(error.message);

  await logAdminAction({
    adminUserId: admin.id,
    action: "cancel_transaction",
    entityType: "transaction",
    entityId: transactionId,
  });

  revalidatePath(`/admin/spaces/${spaceIdForRevalidate}`);
}
