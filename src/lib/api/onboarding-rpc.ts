import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Onboarding sırasında kullanılan, finansal olmayan RPC/CRUD sarmalayıcıları.
 * financial-rpc.ts'deki kuralın aynısı geçerli: uygulama kodu bu dosyadaki
 * fonksiyonlar dışında Supabase çağrısı yapmaz, hepsi isimli parametre
 * nesnesi alır.
 */

type Uuid = string;

// ─────────────────────────────────────────────
// create_space_with_book
// ─────────────────────────────────────────────

export interface CreateSpaceWithBookParams {
  p_type: "home" | "business";
  p_name: string;
  p_currency?: string;
  /** Yalnızca type="business" için anlamlıdır. */
  p_sector?: string | null;
  /**
   * true ise, alan+defterle AYNI atomik veritabanı işleminde bir "Kasa"
   * hesabı da oluşturulur — bu hesap oluşturma başarısız olursa (ör.
   * negatif açılış bakiyesi) TÜM işlem (space+book dahil) geri alınır.
   */
  p_create_default_account?: boolean;
  p_default_account_opening_balance_cents?: number;
}

export interface CreateSpaceWithBookResult {
  space_id: Uuid;
  book_id: Uuid;
  /** p_create_default_account=false ise NULL. */
  account_id: Uuid | null;
}

export async function createSpaceWithBook(
  client: SupabaseClient,
  params: CreateSpaceWithBookParams
) {
  return client.rpc("create_space_with_book", params).single<CreateSpaceWithBookResult>();
}

// ─────────────────────────────────────────────
// update_space_details / archive_space — "Alanlarım" yönetimi.
// Genel spaces_update_owner_admin RLS politikası owner+admin'e serbest
// UPDATE izni verir, ama isim değişikliği YALNIZCA owner'a, arşivleme
// YALNIZCA owner'a kısıtlanmalıdır — bu yüzden bu dar RPC'ler üzerinden
// gidilir, asla doğrudan .from('spaces').update(...) çağrılmaz.
// ─────────────────────────────────────────────

export interface UpdateSpaceDetailsParams {
  p_space_id: Uuid;
  /** Verilmezse isim değişmez. Verilirse yalnızca owner çağırabilir. */
  p_name?: string | null;
  /** Verilmezse sektör değişmez. Verilirse owner/admin çağırabilir, yalnızca type=business için geçerlidir. */
  p_sector?: string | null;
}

export async function updateSpaceDetails(client: SupabaseClient, params: UpdateSpaceDetailsParams) {
  return client.rpc("update_space_details", params);
}

export interface ArchiveSpaceParams {
  p_space_id: Uuid;
  /** true = arşivle (varsayılan), false = arşivden çıkar. Yalnızca owner çağırabilir. */
  p_archived?: boolean;
}

export async function archiveSpace(client: SupabaseClient, params: ArchiveSpaceParams) {
  return client.rpc("archive_space", params);
}

// ─────────────────────────────────────────────
// Tema tercihi — düz tablo güncellemesi (RPC değil, basit bir alan).
// profiles zaten "kullanıcı kendi satırını günceller" RLS politikasına
// sahip (0005), bu yüzden ayrı bir fonksiyon gerekmiyor.
// ─────────────────────────────────────────────

export type ThemePreference = "light" | "dark" | "system";

/**
 * `.maybeSingle()` KASITLI olarak `.single()` yerine kullanılır: eğer
 * (nadir bir veri tutarsızlığıyla) bu kullanıcı için profiles satırı
 * henüz yoksa, `.single()` PostgREST'te 406 hatası fırlatır ve konsola
 * gürültü düşer — `.maybeSingle()` bu durumda sessizce `data: null`
 * döner, çağıran taraf (ThemeSync) zaten `!data` kontrolü yapıyor.
 */
export async function getThemePreference(client: SupabaseClient, userId: Uuid) {
  return client
    .from("profiles")
    .select("theme_preference")
    .eq("user_id", userId)
    .maybeSingle<{ theme_preference: ThemePreference }>();
}

export async function setThemePreference(
  client: SupabaseClient,
  userId: Uuid,
  theme: ThemePreference
) {
  return client.from("profiles").update({ theme_preference: theme }).eq("user_id", userId);
}
