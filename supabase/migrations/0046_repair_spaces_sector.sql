-- 0046_repair_spaces_sector.sql
-- Amaç: 0044_spaces_sector.sql bazı ortamlarda (ör. MIGRATION_FROM ile
-- yanlışlıkla atlanarak) hiç UYGULANMAMIŞ olabilir — bu durumda 0045'te
-- oluşturulan create_space_with_book() fonksiyonu, spaces.sector sütununa
-- INSERT yapmaya çalıştığında ÇALIŞMA ZAMANINDA (CREATE anında DEĞİL,
-- çünkü plpgsql gövdeleri çağrılana kadar sütun/tablo varlığı için
-- doğrulanmaz) "column sector does not exist" hatası verir.
--
-- Bu migration TAMAMEN İDEMPOTENTTİR — 0044 zaten uygulanmış bir ortamda
-- (ADD COLUMN IF NOT EXISTS sayesinde) hiçbir hata vermeden, hiçbir veri
-- kaybı olmadan, sessizce hiçbir şey yapmadan geçer. 0044 HİÇ
-- uygulanmamış bir ortamda ise eksik sütunu tamamlar. Her iki durumda da
-- migration geçmişi/numaralandırması BOZULMAZ — 0044 dosyası olduğu gibi
-- kalır, bu yalnızca bir "onarım" migration'ıdır.

alter table public.spaces add column if not exists sector text;

comment on column public.spaces.sector is
  'Yalnızca type=business için anlamlıdır. Kullanıcının işletme oluşturma '
  'formunda isteğe bağlı olarak seçebileceği sektör bilgisi — şu an yalnızca '
  'bilgilendirme amaçlı, hiçbir hesaplamaya veya yetkilendirmeye girmez. '
  '(0046: bu sütun 0044''te eklenmiş olmalıydı; bazı ortamlarda o dosya '
  'atlanmış olabileceğinden burada İDEMPOTENT olarak güvence altına alınır.)';

-- create_space_with_book() fonksiyonunun KENDİSİ burada yeniden
-- oluşturulmuyor — 0045'teki gövdesi zaten doğruydu, yalnızca ALTINDAKİ
-- sütun eksikti. Sütun artık garanti altında olduğu için fonksiyon bir
-- sonraki çağrıda kendiliğinden doğru çalışır. Bunu doğrulamak için:
--
--   select * from public.create_space_with_book(
--     'business', 'Onarım Testi', 'TRY', 'technology', true, 0
--   );
--
-- Bu çağrı HATASIZ dönmeli ve public.spaces tablosunda sector='technology'
-- olarak görünmelidir.
