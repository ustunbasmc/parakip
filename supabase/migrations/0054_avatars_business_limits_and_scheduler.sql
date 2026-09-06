-- 0054_avatars_business_limits_and_scheduler.sql
-- Amaç: (1) Profil fotoğrafı için Storage bucket+RLS, (2) İşletme paketi
-- limitlerinin merkezi/veritabanı seviyesinde uygulanması, (3) bildirim
-- zamanlayıcısının (0048/0049) service_role ile güvenli tetiklenmesi
-- için altyapı. SAF EKLEME — mevcut RLS, audit, finansal RPC, borç/
-- bütçe/yatırım/satış/alış/müşteri/tedarikçi altyapısı ve `0052`'deki
-- Ev Premium kontrolü HİÇ DEĞİŞTİRİLMEDİ.

-- ─────────────────────────────────────────────
-- 1) AVATAR STORAGE — özel (private) bucket. "Başka kullanıcının avatar
-- dosyasına erişim mümkün olmamalı" kuralı gereği bucket PUBLIC değildir;
-- her kullanıcı yalnızca kendi user_id klasörüne (avatars/<user_id>/...)
-- yazabilir/okuyabilir. Görüntüleme için imzalı (signed) URL kullanılır
-- (bkz. avatars.ts) — herkese açık, süresiz bir URL YOKTUR.
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select_own
  on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_insert_own
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

comment on column public.profiles.avatar_url is
  'Avatar dosyasının Supabase Storage PATH''i (ör. "<user_id>/avatar.jpg") '
  'saklanır — herkese açık bir URL DEĞİLDİR (bucket private). Görüntülemek '
  'için her seferinde kısa ömürlü bir imzalı URL üretilir (bkz. avatars.ts).';

-- ─────────────────────────────────────────────
-- 2) İşletme paketi — merkezi limit tanımı + kontrol fonksiyonu.
-- Ev Premium (has_home_premium, 0052) HİÇ DEĞİŞTİRİLMEDİ.
-- ─────────────────────────────────────────────
create or replace function public.business_free_limits()
returns jsonb
language sql
immutable
as $$
  select '{
    "accounts": 10,
    "monthly_transactions": 150,
    "debts": 40,
    "customers": 30,
    "suppliers": 30
  }'::jsonb;
$$;

comment on function public.business_free_limits is
  'İşletme (ücretsiz/henüz abonelik satın alınmamış) plan limitlerinin TEK '
  've MERKEZİ kaynağı. Tüm limit trigger''ları buradan okur — sayı '
  'değiştirmek için tek bu fonksiyon güncellenir.';

create or replace function public.has_business_subscription(p_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.subscriptions
    where plan = 'business'
      and space_id = p_space_id
      and status = 'active'
      and (current_period_end is null or current_period_end > now())
  );
$$;

comment on function public.has_business_subscription is
  'İşletme aboneliği ALAN BAZLIDIR (space_id) — o alanın owner/admin/'
  'editor/viewer HERHANGİ bir üyesi için AYNI sonucu döner (kullanıcıya '
  'göre değil, alana göre değerlendirilir).';

revoke all on function public.has_business_subscription(uuid) from public;
grant execute on function public.has_business_subscription(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- accounts limiti (0052'deki fonksiyon GENİŞLETİLİYOR — trigger'ın
-- kendisi ve mevcut Ev davranışı DEĞİŞMEDEN, yalnızca İşletme dalı
-- eklendi).
-- ─────────────────────────────────────────────
create or replace function public.enforce_account_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_space_type text;
  v_owner uuid;
  v_count integer;
  v_limit integer;
begin
  select s.id, s.type, s.owner_user_id into v_space_id, v_space_type, v_owner
  from public.books b
  join public.spaces s on s.id = b.space_id
  where b.id = new.book_id;

  if v_space_type = 'home' and not public.has_home_premium(v_owner) then
    v_limit := 5;
  elsif v_space_type = 'business' and not public.has_business_subscription(v_space_id) then
    v_limit := (public.business_free_limits()->>'accounts')::integer;
  else
    return new; -- Premium/aktif abonelik: sınır yok
  end if;

  select count(*) into v_count from public.accounts where book_id = new.book_id;
  if v_count >= v_limit then
    raise exception
      'Ücretsiz plan en fazla % hesaba izin verir. Sınırı kaldırmak için % planına geçebilirsiniz.',
      v_limit, case when v_space_type = 'home' then 'Ev Premium' else 'İşletme' end;
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- Müşteri/tedarikçi/borç sayısı — YALNIZCA İşletme alanları için
-- (Ev'de müşteri/tedarikçi kavramı zaten yok; Ev borçları bu limitten
-- ETKİLENMEZ).
-- ─────────────────────────────────────────────
create or replace function public.enforce_party_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_type text;
  v_count integer;
  v_limit integer;
  v_limit_key text;
  v_table text := tg_table_name;
begin
  select type into v_space_type from public.spaces where id = new.space_id;
  if v_space_type is distinct from 'business' then
    return new; -- Ev icin bu tablo/limit kavramı yok
  end if;

  if public.has_business_subscription(new.space_id) then
    return new;
  end if;

  v_limit_key := case v_table when 'customers' then 'customers' else 'suppliers' end;
  v_limit := (public.business_free_limits()->>v_limit_key)::integer;

  execute format('select count(*) from public.%I where space_id = $1', v_table)
    into v_count using new.space_id;

  if v_count >= v_limit then
    raise exception
      'Ücretsiz İşletme planında en fazla % kayıt ekleyebilirsiniz. Sınırı kaldırmak için İşletme aboneliğine geçebilirsiniz.',
      v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists customers_enforce_limit on public.customers;
create trigger customers_enforce_limit
  before insert on public.customers
  for each row execute function public.enforce_party_limit();

drop trigger if exists suppliers_enforce_limit on public.suppliers;
create trigger suppliers_enforce_limit
  before insert on public.suppliers
  for each row execute function public.enforce_party_limit();

-- ─────────────────────────────────────────────
-- Borç/alacak sayısı — YALNIZCA İşletme defterleri için.
-- ─────────────────────────────────────────────
create or replace function public.enforce_debt_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_space_type text;
  v_count integer;
  v_limit integer;
begin
  select s.id, s.type into v_space_id, v_space_type
  from public.books b join public.spaces s on s.id = b.space_id
  where b.id = new.book_id;

  if v_space_type is distinct from 'business' or public.has_business_subscription(v_space_id) then
    return new;
  end if;

  v_limit := (public.business_free_limits()->>'debts')::integer;
  select count(*) into v_count from public.debts where book_id = new.book_id;
  if v_count >= v_limit then
    raise exception
      'Ücretsiz İşletme planında en fazla % borç/alacak kaydı oluşturabilirsiniz. Sınırı kaldırmak için İşletme aboneliğine geçebilirsiniz.',
      v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists debts_enforce_limit on public.debts;
create trigger debts_enforce_limit
  before insert on public.debts
  for each row execute function public.enforce_debt_limit();

-- ─────────────────────────────────────────────
-- Aylık işlem sayısı — YALNIZCA İşletme defterleri için. transactions
-- tablosunda book_id YOK (book_id yalnızca transaction_entries'te var),
-- bu yüzden kontrol transaction_entries INSERT'inde yapılır; transfer'in
-- iki bacağının ÇİFT SAYILMAMASI için yalnızca income/expense türü
-- işlemler sayılır.
-- ─────────────────────────────────────────────
create or replace function public.enforce_monthly_entry_transaction_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_space_type text;
  v_tx_type text;
  v_count integer;
  v_limit integer;
  v_month_start timestamptz;
begin
  select s.id, s.type into v_space_id, v_space_type
  from public.books b join public.spaces s on s.id = b.space_id
  where b.id = new.book_id;

  if v_space_type is distinct from 'business' or public.has_business_subscription(v_space_id) then
    return new;
  end if;

  select type into v_tx_type from public.transactions where id = new.transaction_id;
  if v_tx_type = 'transfer' then
    return new; -- transfer'in iki bacağı ayrı ayrı sayılmaz, limit gelir/gidere uygulanır
  end if;

  v_month_start := date_trunc('month', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
  v_limit := (public.business_free_limits()->>'monthly_transactions')::integer;

  select count(distinct te.transaction_id) into v_count
  from public.transaction_entries te
  join public.transactions t on t.id = te.transaction_id
  where te.book_id = new.book_id
    and t.type in ('income', 'expense')
    and t.occurred_at >= v_month_start;

  if v_count >= v_limit then
    raise exception
      'Ücretsiz İşletme planında ayda en fazla % işlem kaydedebilirsiniz. Sınırı kaldırmak için İşletme aboneliğine geçebilirsiniz.',
      v_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_entries_enforce_monthly_limit on public.transaction_entries;
create trigger transaction_entries_enforce_monthly_limit
  before insert on public.transaction_entries
  for each row execute function public.enforce_monthly_entry_transaction_limit();

-- ─────────────────────────────────────────────
-- 3) Bildirim zamanlayıcısı — pg_cron VARSA otomatik kurulur; YOKSA
-- migration HATA VERMEDEN devam eder (bkz. proje raporu — bu durumda
-- /api/cron/run-notifications güvenli endpoint'i kullanılmalıdır).
-- ─────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'run-scheduled-notifications',
      '0 6 * * *', -- UTC 06:00 = Europe/Istanbul 09:00 (yaz saati: 08:00'e denk gelebilir, DST dokumante edilmelidir)
      $cron$select public.run_scheduled_notifications();$cron$
    );
  else
    raise notice 'pg_cron eklentisi bulunamadı — zamanlayici KURULMADI. /api/cron/run-notifications endpoint''i ile harici bir zamanlayici (ör. Vercel Cron) kullanin.';
  end if;
exception when others then
  raise notice 'pg_cron zamanlaması kurulamadı (%): harici zamanlayıcı (/api/cron/run-notifications) kullanılmalı.', sqlerrm;
end $$;
