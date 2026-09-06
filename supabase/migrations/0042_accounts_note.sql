-- 0042_accounts_note.sql
-- Amaç: Yeni hesap formunda istenen "Açıklama (isteğe bağlı)" alanı için
-- accounts tablosuna nullable bir sütun. Saf ekleme — hiçbir mevcut
-- politika/fonksiyon/kısıt değişmiyor.

alter table public.accounts add column note text;

comment on column public.accounts.note is
  'Kullanıcının hesap oluştururken girebileceği isteğe bağlı açıklama '
  '(ör. "Ortak hesap", "Yalnızca acil durum"). Salt bilgilendirme amaçlı, '
  'hiçbir hesaplamaya girmez.';
