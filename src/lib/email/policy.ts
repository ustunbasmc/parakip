/**
 * Uygulama e-postalarının (Resend API) hangi türlerinin gönderileceği.
 *
 * Gönderim kotasını korumak için yalnızca uygulama içinde KARŞILIĞI
 * OLMAYAN kritik e-postalar açıktır. Kayıt onayı / şifre sıfırlama /
 * e-posta değişikliği bu listeye tabi DEĞİLDİR — onları Supabase Auth
 * kendi SMTP ayarıyla gönderir.
 *
 * Bir türü yeniden açmak için değeri `true` yapmak yeterlidir.
 */
export type EmailCategory =
  | "billing" // havale onay/red — uygulama içinde bildirimi yok, para ile ilgili
  | "admin_test" // admin panelindeki elle test
  | "space_invitation" // davet — zil bildirimi + paylaşılabilir bağlantı var
  | "support_user_reply" // admin yanıtı → kullanıcı — zil bildirimi var
  | "support_team"; // yeni talep / kullanıcı mesajı → ekip — admin menüsü rozeti var

export const EMAIL_CATEGORY_ENABLED: Record<EmailCategory, boolean> = {
  billing: true,
  admin_test: true,
  space_invitation: false,
  support_user_reply: false,
  support_team: false,
};

export const EMAIL_CATEGORY_LABELS: Record<EmailCategory, string> = {
  billing: "Havale onay/red → kullanıcı",
  admin_test: "Admin test e-postası",
  space_invitation: "Alan daveti",
  support_user_reply: "Destek yanıtı → kullanıcı",
  support_team: "Yeni destek talebi / mesaj → ekip",
};
