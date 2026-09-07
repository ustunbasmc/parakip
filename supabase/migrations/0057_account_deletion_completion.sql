-- 0057_account_deletion_completion.sql
-- Amaç: Kullanıcı hesabı silme akışının GÜVENLİ tamamlanması için SAF
-- EKLEME. `auth.users` satırının FİZİKSEL SİLİNMESİ bilinçli olarak
-- YAPILMAZ — spaces.owner_user_id (ve dolayısıyla books/accounts/
-- transactions/debts) `on delete cascade` ile auth.users'a bağlı olduğu
-- için gerçek bir DELETE, o kullanıcının TÜM finansal geçmişini de
-- CASCADE ile silerdi — bu, projenin "finansal kayıtlar asla fiziksel
-- olarak silinmez" temel ilkesini ihlal eder.
--
-- Bunun yerine "hesap silme tamamlandı" şu şekilde uygulanır:
--   1. auth.users.email service_role tarafından anonim bir değere
--      değiştirilir ve hesap banlanır (giriş yapılamaz hale gelir) —
--      auth.users SATIRI KORUNUR, yalnızca kişisel veri temizlenir.
--   2. profiles'daki kişisel alanlar (first_name/last_name/phone/
--      avatar_url) temizlenir.
--   3. Bu sütun (deletion_completed_at) işaretlenir.
-- spaces/accounts/transactions/debts HİÇ DOKUNULMAZ — finansal geçmiş
-- ve audit bütünlüğü tam korunur.

alter table public.profiles add column if not exists deletion_completed_at timestamptz;

comment on column public.profiles.deletion_completed_at is
  'Hesap silme talebi GÜVENLİ şekilde tamamlandığında (kişisel veri '
  'anonimleştirildi, hesap banlandı) işaretlenir. auth.users satırı '
  'FİZİKSEL OLARAK SİLİNMEZ (cascade riski — bkz. yukarıdaki not); '
  'yalnızca kişisel veri temizlenir ve giriş engellenir. Finansal '
  'kayıtlar bu işlemden HİÇ ETKİLENMEZ.';
