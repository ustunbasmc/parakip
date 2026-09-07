-- 0056_profile_name_phone.sql
-- Amaç: Kayıt formuna ad/soyad/telefon eklenmesi için SAF EKLEME. Mevcut
-- profiles şeması, RLS (profiles_select_own/profiles_update_own zaten
-- yeni sütunları da kapsar — RLS satır bazlıdır, sütun eklemek politika
-- değişikliği GEREKTİRMEZ) ve auth.users/Supabase Auth akışı HİÇ
-- DEĞİŞTİRİLMEDİ. Telefon Supabase Auth'un KENDİ `phone` alanında
-- TUTULMUYOR (bu, SMS doğrulamasını TETİKLERDİ) — yalnızca profiles
-- tablosunda düz veri olarak saklanır. İdempotent: `add column if not
-- exists` ve `create or replace function` kullanılır, migration ikinci
-- kez çalıştırılsa bile hata vermez.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone text;

comment on column public.profiles.phone is
  'Türkiye formatında normalize edilmiş cep telefonu: +905XXXXXXXXX (13 '
  'karakter). Supabase Auth''un phone alanı DEĞİLDİR — SMS/telefon '
  'doğrulamasını TETİKLEMEZ, yalnızca profil bilgisidir. Boş bırakılabilir '
  '(mevcut kullanıcılar için geriye dönük uyumluluk).';

-- Telefon girilmişse GEÇERLİ formatta olmasını veritabanı seviyesinde de
-- garanti eder (yalnızca istemci doğrulamasına güvenilmez). Mevcut
-- satırlarla (hepsi NULL) ÇAKIŞMAZ.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_format_check'
  ) then
    alter table public.profiles
      add constraint profiles_phone_format_check
      check (phone is null or phone ~ '^\+905\d{9}$');
  end if;
end $$;

-- Mevcut handle_new_user() GENİŞLETİLİYOR (trigger'ın kendisi ve mevcut
-- davranışı DEĞİŞMEDEN): signUp() çağrısında options.data ile gönderilen
-- first_name/last_name/phone, auth.users.raw_user_meta_data üzerinden
-- okunup profile aktarılır. Hiçbiri gönderilmezse (ör. eski/başka bir
-- akış) önceki davranışla TAM UYUMLU şekilde yalnızca display_name=email
-- ile devam eder.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first_name text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  v_last_name text := nullif(trim(new.raw_user_meta_data->>'last_name'), '');
  v_phone text := nullif(trim(new.raw_user_meta_data->>'phone'), '');
  v_display_name text;
begin
  v_display_name := trim(both ' ' from coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, ''));
  if v_display_name = '' then
    v_display_name := new.email;
  end if;

  insert into public.profiles (user_id, display_name, first_name, last_name, phone)
  values (new.id, v_display_name, v_first_name, v_last_name, v_phone);

  return new;
end;
$$;
