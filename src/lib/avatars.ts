import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Avatar Storage yardımcıları. Bucket PRIVATE'tir (bkz. migration 0054)
 * — herkese açık, süresiz bir URL asla üretilmez; her görüntülemede
 * kısa ömürlü bir imzalı URL alınır. profiles.avatar_url her zaman
 * Storage PATH'i tutar (ör. "<user_id>/avatar.jpg"), URL değil.
 */

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB — bucket'taki file_size_limit ile aynı

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES[file.type]) {
    return "Yalnızca JPG, PNG veya WebP formatında bir görsel yükleyebilirsin.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Görsel en fazla 2 MB olabilir.";
  }
  return null;
}

/**
 * Sabit bir dosya adı (avatar.<uzantı>) kullanır ve upsert eder — böylece
 * kullanıcı fotoğrafını değiştirdiğinde AYNI path üzerine yazılır, eski
 * dosya YETİM KALMAZ (ayrı bir silme adımı gerekmez). Farklı bir uzantıya
 * geçilirse (ör. png→jpg) önceki uzantılı dosya AYRICA silinir.
 */
export async function uploadAvatar(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateAvatarFile(file);
  if (validationError) return { path: null, error: validationError };

  const ext = ALLOWED_TYPES[file.type];
  const path = `${userId}/avatar.${ext}`;

  // Farklı uzantılı eski dosyaları temizle (yetim dosya bırakmamak için).
  const otherExts = Object.values(ALLOWED_TYPES).filter((e) => e !== ext);
  const staleePaths = otherExts.map((e) => `${userId}/avatar.${e}`);
  if (staleePaths.length > 0) {
    await supabase.storage.from("avatars").remove(staleePaths);
  }

  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { path: null, error: "Fotoğraf yüklenemedi. Lütfen tekrar dene." };

  return { path, error: null };
}

/** Yalnızca SUNUCU tarafında (server component) çağrılmalı — kısa ömürlü imzalı URL üretir. */
export async function getSignedAvatarUrl(supabase: SupabaseClient, avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) return null;
  const { data, error } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export interface ProfileHeaderInfo {
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * ProfileMenu'yü render eden TÜM sayfaların ortak kullandığı tek sorgu —
 * kod tekrarını önler (7 sayfa aynı display_name+avatar_url+imzalı URL
 * mantığını tekrar yazmak yerine buradan çağırır).
 */
export async function getProfileHeaderInfo(supabase: SupabaseClient, userId: string): Promise<ProfileHeaderInfo> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  const avatarUrl = await getSignedAvatarUrl(supabase, profile?.avatar_url ?? null);
  return { displayName: profile?.display_name ?? null, avatarUrl };
}
