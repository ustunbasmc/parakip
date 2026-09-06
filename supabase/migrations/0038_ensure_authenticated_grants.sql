-- 0038_ensure_authenticated_grants.sql
-- Amaç: Bu proje boyunca YEREL test ortamında, Supabase'in gerçek
-- projelerde platform seviyesinde otomatik sağladığı varsayılan tablo
-- yetkilerini (authenticated/anon rollerine) ELLE simüle etmemiz
-- gerekmişti (bkz. Adım 1 raporundaki "Bilinen Risk" maddesi). Bu
-- migration, o varsayıma güvenmek yerine gerekli yetkileri AÇIKÇA ve
-- İDEMPOTENT olarak tanımlar — gerçek bir Supabase projesinde bu
-- migration çalıştırıldığında (platformun kendi varsayımı ne olursa
-- olsun) uygulamanın doğru çalışması garanti altına alınmış olur.
--
-- Not: Bu yalnızca GRANT'tir — asıl güvenlik RLS politikalarındadır
-- (bu migration hiçbir RLS politikası eklemez/değiştirmez). GRANT
-- olmadan RLS'in kendisi hiçbir işe yaramaz (Postgres önce GRANT'i
-- kontrol eder, sonra RLS'i); bu yüzden ikisi birlikte tam güvenliği
-- oluşturur.

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.spaces to authenticated;
grant select, insert, update, delete on public.space_members to authenticated;
grant select, insert, update on public.books to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;

comment on schema public is
  'Parakip ana şeması. authenticated rolüne temel tablo GRANT''leri '
  '0038_ensure_authenticated_grants.sql''de açıkça tanımlıdır; asıl erişim '
  'kontrolü her tablonun kendi RLS politikalarındadır.';
