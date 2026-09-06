-- 0002_profiles.sql
-- Amaç: Her auth.users kaydına karşılık gelen genel kullanıcı profili.
-- RLS bu dosyada AÇILMIYOR; tüm RLS politikaları 0005'te tek yerde toplanıyor.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'tr-TR',
  currency_default text not null default 'TRY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Kullanıcıya ait genel profil bilgisi. auth.users ile 1:1 ilişkilidir.';

-- Yeni bir auth.users kaydı oluşturulduğunda otomatik olarak boş bir
-- profil satırı açan trigger. Bu sayede uygulama kodu her kayıt akışında
-- ayrıca "profil oluştur" adımını unutma riskiyle karşılaşmaz.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at otomatik güncelleme yardımcı fonksiyonu (sonraki migration'larda
-- diğer tablolar için de tekrar kullanılacak).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
