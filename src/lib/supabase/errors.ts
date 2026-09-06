/**
 * Supabase Auth, hata mesajlarını İNGİLİZCE döner. Bu fonksiyon, sık
 * görülen hataları anlaşılır Türkçe'ye çevirir ("Hataları açık ve
 * anlaşılır Türkçe ile göster" kuralı). Eşleşme bulunamazsa, kullanıcıyı
 * teknik olmayan genel bir mesajla bilgilendirir — ham İngilizce metin
 * hiçbir zaman doğrudan gösterilmez.
 */
export function translateAuthError(message: string | undefined | null): string {
  if (!message) return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";

  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı. Lütfen tekrar deneyin.";
  }
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.";
  }
  if (m.includes("password should be at least")) {
    return "Şifre en az 6 karakter olmalıdır.";
  }
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "Geçerli bir e-posta adresi girin.";
  }
  if (m.includes("email not confirmed")) {
    return "E-posta adresini henüz onaylamadın. Gelen kutunu kontrol et.";
  }
  if (m.includes("email rate limit") || m.includes("rate limit")) {
    return "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Bağlantı sorunu oluştu. İnternet bağlantını kontrol edip tekrar dene.";
  }
  if (m.includes("same password") || m.includes("should be different")) {
    return "Yeni şifre, mevcut şifreyle aynı olamaz.";
  }

  return "Bir şeyler ters gitti. Lütfen tekrar deneyin.";
}
