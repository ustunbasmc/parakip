-- 0052_subscriptions_and_limits.sql
-- Amaç: Abonelik/paket/limit sisteminin TEMELİ. SAF EKLEME — mevcut
-- alan/kullanıcı/RLS/owner-admin yetkileri, borç/bütçe/yatırım/satış/
-- alış/müşteri/tedarikçi altyapısı HİÇ DEĞİŞTİRİLMEDİ.
--
-- KAPSAM (bilinçli sınırlama, bu turda kapsamlı test yapılmayacağı için):
-- yalnızca Ev ücretsiz plan için HESAP SAYISI limiti veritabanı
-- seviyesinde (trigger ile) zorunlu kılınıyor — "kritik limitleri
-- sunucu/RPC/veritabanı seviyesinde de doğrula" kuralını somut ve test
-- edilebilir şekilde karşılamak için. Diğer limit türleri (aylık işlem,
-- borç/alacak, rapor) bu turda yalnızca ARAYÜZDE gösterilir/uyarılır —
-- gelecekte AYNI desenle (trigger + subscriptions tablosu) genişletilebilir.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan text not null check (plan in ('home_premium', 'business')),
  -- Ev Premium: SAHİP BAZLI (owner_user_id) — "Premium kontrolü işlemi
  -- yapan kullanıcıya değil, space.owner_user_id'ye göre yapılmalı"
  -- kuralı BUNUNLA sağlanır: sahip premium ise o Ev'deki TÜM üyeler
  -- (has_home_premium fonksiyonu owner'a bakar) faydalanır.
  owner_user_id uuid references auth.users (id) on delete cascade,
  -- İşletme: ALAN BAZLI (space_id) — mevcut owner/admin/editor/viewer
  -- üyelik yapısıyla doğal olarak uyumludur (alan kimin sahibi olduğuna
  -- bakılmaksızın, o ALANIN ÜYESİ olan herkes faydalanır — ayrı bir
  -- kontrol fonksiyonu gerekmez, mevcut is_space_member yeterlidir).
  space_id uuid references public.spaces (id) on delete cascade,
  status text not null default 'inactive' check (status in ('active', 'inactive', 'trialing', 'cancelled')),
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (plan = 'home_premium' and owner_user_id is not null and space_id is null)
    or
    (plan = 'business' and space_id is not null and owner_user_id is null)
  )
);

comment on table public.subscriptions is
  'Abonelik/paket durumu. Bu turda GERÇEK bir ödeme sağlayıcısı entegre '
  'EDİLMEDİ — satırlar yalnızca MANUEL/TEST amaçlı (ör. Supabase Dashboard''dan '
  'elle) oluşturulur/güncellenir. İstemciye (authenticated) hiçbir INSERT/'
  'UPDATE/DELETE grant''ı YOKTUR — kullanıcı kendi planını asla değiştiremez, '
  'yalnızca görüntüleyebilir.';

create index subscriptions_owner_idx on public.subscriptions (owner_user_id) where owner_user_id is not null;
create index subscriptions_space_idx on public.subscriptions (space_id) where space_id is not null;

alter table public.subscriptions enable row level security;

create policy subscriptions_select_own_home on public.subscriptions
  for select using (plan = 'home_premium' and owner_user_id = auth.uid());
create policy subscriptions_select_own_business on public.subscriptions
  for select using (plan = 'business' and public.is_space_member(space_id));

grant select on public.subscriptions to authenticated;
-- INSERT/UPDATE/DELETE grant'i BİLEREK YOK.

-- ─────────────────────────────────────────────
-- has_home_premium — Ev Premium kontrolü SAHİP BAZLI yapılır.
-- ─────────────────────────────────────────────
create or replace function public.has_home_premium(p_owner_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.subscriptions
    where plan = 'home_premium'
      and owner_user_id = p_owner_user_id
      and status = 'active'
      and (current_period_end is null or current_period_end > now())
  );
$$;

comment on function public.has_home_premium is
  'Ev Premium kontrolü SAHİP (space.owner_user_id) bazlıdır — işlemi yapan '
  'kullanıcı DEĞİL. Bir Ev alanının sahibi Premium ise, o alanın TÜM '
  'üyeleri (editor dahil) Premium avantajlarından faydalanır.';

revoke all on function public.has_home_premium(uuid) from public;
grant execute on function public.has_home_premium(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Ev ücretsiz plan — hesap sayısı limiti (VERİTABANI SEVİYESİNDE).
-- Yalnızca type='home' VE sahip Premium DEĞİLSE uygulanır. İşletme
-- alanları bu turda SINIRLANMAZ (İşletme paketi henüz aktif değil,
-- "Yakında" — bkz. proje raporu).
-- ─────────────────────────────────────────────
create or replace function public.enforce_account_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_type text;
  v_owner uuid;
  v_count integer;
  v_limit constant integer := 5;
begin
  select s.type, s.owner_user_id into v_space_type, v_owner
  from public.books b
  join public.spaces s on s.id = b.space_id
  where b.id = new.book_id;

  if v_space_type = 'home' and not public.has_home_premium(v_owner) then
    select count(*) into v_count from public.accounts where book_id = new.book_id;
    if v_count >= v_limit then
      raise exception
        'Ücretsiz Ev planında en fazla % hesap ekleyebilirsiniz. Ev Premium''e geçerek bu sınırı kaldırabilirsiniz.',
        v_limit;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_account_limit is
  '"Kritik limitleri veritabanı seviyesinde de doğrula" kuralının somut '
  'karşılığı — yalnızca arayüz kontrolüne güvenilmez. BEFORE INSERT trigger '
  'olduğu için limit aşımında hiçbir yarım kayıt OLUŞMAZ (transaction hiç '
  'başlamaz).';

create trigger accounts_enforce_limit
  before insert on public.accounts
  for each row
  execute function public.enforce_account_limit();
