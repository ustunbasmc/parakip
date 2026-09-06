-- 0044_spaces_sector.sql
-- Amaç: "Sonradan İşletme alanı oluşturma" formunda istenen isteğe bağlı
-- "Sektör" alanı için spaces tablosuna nullable bir sütun. accounts.note
-- (0042) ile AYNI GEREKÇE: form bu bilgiyi topluyorsa ama hiçbir yere
-- kaydedilmiyorsa, bu "sahte veri toplama" ile aynı sorunu taşır. Saf
-- ekleme — hiçbir mevcut politika/fonksiyon/kısıt değişmiyor,
-- create_space_with_book() bu sütuna hiç dokunmuyor (bilerek — sektör
-- yalnızca UI'de doldurulur, ayrı bir UPDATE ile yazılır).

alter table public.spaces add column sector text;

comment on column public.spaces.sector is
  'Yalnızca type=business için anlamlıdır. Kullanıcının işletme oluşturma '
  'formunda isteğe bağlı olarak seçebileceği sektör bilgisi — şu an yalnızca '
  'bilgilendirme amaçlı, hiçbir hesaplamaya veya yetkilendirmeye girmez.';
