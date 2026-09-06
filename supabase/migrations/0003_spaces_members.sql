-- 0003_spaces_members.sql
-- Amaç: Ev/İşletme "alan" (space) yapısı ve alan üyelikleri.
-- KARAR D10: Kullanıcı başına yalnızca 1 Ev (home) alanı olabilir.
-- Bu kural, uygulama kodunun unutmasına karşı VERİTABANI SEVİYESİNDE
-- zorunlu kılınır (kısmi tekil indeks).

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('home', 'business')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.spaces is
  'Ev veya İşletme çalışma alanı. type=home için owner_user_id başına en fazla 1 satır olabilir (bkz. spaces_one_home_per_user).';

-- KARAR D10'un veritabanı seviyesinde uygulanması:
-- Bir kullanıcının owner_user_id olarak göründüğü type='home' satır sayısı 1 ile sınırlanır.
-- İşletme (business) alanları bu kısıtın dışındadır; bir kullanıcı birden çok işletmeye sahip olabilir.
create unique index spaces_one_home_per_user
  on public.spaces (owner_user_id)
  where type = 'home';

create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

-- Alan üyelikleri ve roller.
create table public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

comment on table public.space_members is
  'Bir space''e üye olan kullanıcılar ve rolleri. owner rolündeki satır, space oluşturulduğunda otomatik eklenir (bkz. handle_new_space).';

-- Bir space oluşturulduğunda, sahibini otomatik olarak 'owner' rolüyle
-- space_members tablosuna ekleyen trigger. Bu, RLS politikalarının
-- "space_members üzerinden üyelik kontrolü" mantığını sahip için de
-- ayrık bir özel durum yazmadan tek tip çalıştırmasını sağlar.
create or replace function public.handle_new_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.space_members (space_id, user_id, role, accepted_at)
  values (new.id, new.owner_user_id, 'owner', now());
  return new;
end;
$$;

create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.handle_new_space();
