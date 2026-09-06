-- 0047_space_management.sql
-- Amaç: "Alanlarım" ekranı için gereken alan yönetimi — isim/sektör
-- düzenleme ve arşivleme/yeniden etkinleştirme. SAF EKLEME — hiçbir
-- mevcut fonksiyon/politika/kısıt KALDIRILMADI, yalnızca genişletildi.
--
-- 1) spaces.is_archived — fiziksel silme YOK, yalnızca soft-archive.
-- 2) spaces_one_home_per_user unique index'i, ARŞİVLENMİŞ bir Ev'i
--    SAYMAYACAK şekilde güncellendi — böylece bir kullanıcı Ev'ini
--    arşivlerse yeni bir Ev alanı oluşturabilir (veri KAYBI yok, yalnızca
--    kısıtın kapsamı daraltıldı: eski Ev satırı olduğu gibi durur).
-- 3) audit_log.entity_type'a 'space' eklendi.
-- 4) update_space_details(): mevcut spaces_update_owner_admin RLS
--    politikası owner VE admin'e serbestçe UPDATE izni veriyor — ama isim
--    değişikliği YALNIZCA owner ile sınırlı olmalı (talep gereği). Bu
--    yüzden isim/sektör güncellemesi artık BU dar SECURITY DEFINER
--    fonksiyon üzerinden yapılır (uygulama kodu asla doğrudan
--    .from('spaces').update(...) çağırmaz); genel RLS politikası
--    DEĞİŞTİRİLMEDİ (başka bir ihtiyaç için gelecekte gerekebilir).
-- 5) archive_space(): yalnızca owner çağırabilir.

alter table public.spaces add column is_archived boolean not null default false;

drop index public.spaces_one_home_per_user;
create unique index spaces_one_home_per_user
  on public.spaces (owner_user_id)
  where type = 'home' and is_archived = false;

comment on index public.spaces_one_home_per_user is
  'Kullanıcı başına en fazla 1 AKTİF (arşivlenmemiş) Ev alanı. Bir Ev '
  'arşivlenirse (satır SİLİNMEZ, yalnızca is_archived=true olur) kullanıcı '
  'yeni bir Ev alanı oluşturabilir.';

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment', 'budget', 'holding_transaction', 'account', 'space'));

-- ─────────────────────────────────────────────
-- update_space_details
-- ─────────────────────────────────────────────
create or replace function public.update_space_details(
  p_space_id uuid,
  p_name text default null,
  p_sector text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_type text;
  v_before_name text;
  v_before_sector text;
  v_trimmed_name text;
begin
  select type, name, sector into v_type, v_before_name, v_before_sector
  from public.spaces where id = p_space_id;

  if v_type is null then
    raise exception 'Alan bulunamadi (id=%)', p_space_id;
  end if;

  select id into v_book_id from public.books where space_id = p_space_id;

  -- İsim değişikliği: yalnızca owner.
  if p_name is not null then
    v_trimmed_name := trim(p_name);
    if length(v_trimmed_name) = 0 then
      raise exception 'Alan adi bos olamaz';
    end if;
    if v_trimmed_name <> v_before_name and not public.has_space_role(p_space_id, array['owner']) then
      raise exception 'Alan adini yalnizca alanin sahibi degistirebilir';
    end if;
  end if;

  -- Sektör değişikliği: owner veya admin. Yalnızca type=business icin anlamli.
  if p_sector is not null then
    if v_type <> 'business' then
      raise exception 'sector yalnizca type=business icin gecerlidir';
    end if;
    if not public.has_space_role(p_space_id, array['owner', 'admin']) then
      raise exception 'Sektoru yalnizca alanin sahibi veya yoneticisi degistirebilir';
    end if;
  end if;

  update public.spaces
  set
    name = coalesce(v_trimmed_name, name),
    sector = coalesce(p_sector, sector),
    updated_at = now()
  where id = p_space_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'space', p_space_id,
    jsonb_build_object('name', v_before_name, 'sector', v_before_sector),
    jsonb_build_object('name', coalesce(v_trimmed_name, v_before_name), 'sector', coalesce(p_sector, v_before_sector))
  );
end;
$$;

comment on function public.update_space_details is
  'Bir alanin adini ve/veya sektorunu gunceller. Isim degisikligi YALNIZCA '
  'owner, sektor degisikligi owner/admin yetkisiyle yapilabilir. Genel '
  'spaces_update_owner_admin RLS politikasi buradan ETKİLENMEZ/DEĞİŞMEZ — '
  'uygulama kodu bu alanlari degistirmek icin HER ZAMAN bu fonksiyonu kullanir.';

revoke all on function public.update_space_details(uuid, text, text) from public;
grant execute on function public.update_space_details(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- archive_space
-- ─────────────────────────────────────────────
create or replace function public.archive_space(
  p_space_id uuid,
  p_archived boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_before boolean;
begin
  select is_archived into v_before from public.spaces where id = p_space_id;

  if v_before is null then
    raise exception 'Alan bulunamadi (id=%)', p_space_id;
  end if;

  if not public.has_space_role(p_space_id, array['owner']) then
    raise exception 'Bu islem icin yetkiniz yok (yalnizca alanin sahibi arsivleyebilir)';
  end if;

  if v_before = p_archived then
    if p_archived then
      raise exception 'Bu alan zaten arsivlenmis';
    else
      raise exception 'Bu alan zaten aktif';
    end if;
  end if;

  select id into v_book_id from public.books where space_id = p_space_id;

  update public.spaces
  set is_archived = p_archived, updated_at = now()
  where id = p_space_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'space', p_space_id,
    jsonb_build_object('is_archived', v_before),
    jsonb_build_object('is_archived', p_archived)
  );
end;
$$;

comment on function public.archive_space is
  'Bir alani arsivler/arsivden cikarir. Fiziksel silme YOKTUR — yalnizca '
  'is_archived bayragi degisir, tum defter/hesap/islem gecmisi oldugu gibi '
  'kalir. Yalnizca alanin SAHIBI (owner) cagirabilir. Ev alani icin: '
  'arsivlenmis bir Ev, spaces_one_home_per_user kisitina artik dahil '
  'edilmez, yani kullanici yeni bir Ev alani olusturabilir.';

revoke all on function public.archive_space(uuid, boolean) from public;
grant execute on function public.archive_space(uuid, boolean) to authenticated;
