-- 0053_profile_account_management.sql
-- Amaç: Profil/Hesap Güvenliği modülü için SAF EKLEME. Mevcut profiles
-- şeması, RLS (profiles_update_own zaten kendi satırını güncellemeye
-- izin veriyor — sütun eklemek politika değişikliği GEREKTİRMEZ) ve
-- auth.users hiç değiştirilmedi.

alter table public.profiles add column avatar_url text;
alter table public.profiles add column deletion_requested_at timestamptz;

comment on column public.profiles.avatar_url is
  'Profil fotoğrafı URL''si — bu turda yalnızca ALTYAPI HAZIRLIĞI olarak '
  'eklendi (henüz bir dosya yükleme/Storage bucket akışı KURULMADI, sütun '
  'boş kalabilir).';

comment on column public.profiles.deletion_requested_at is
  'Kullanıcı hesabını silme TALEBİNDE bulunduğunda doldurulur. GERÇEK bir '
  'silme işlemi DEĞİLDİR — service_role/admin API gerektiren fiziksel '
  'kullanıcı silme bu turun kapsamı DIŞINDADIR. Bu yalnızca "talep alındı, '
  'incelenecek" durumunu güvenli şekilde kaydeder; finansal kayıtlar bu '
  'işlemden ETKİLENMEZ, hiçbir veri silinmez.';
