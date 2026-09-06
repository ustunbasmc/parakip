-- 0037_onboarding_support.sql
-- Amaç: İlk kullanıcı arayüzü (onboarding) için iki destek parçası.
--
-- (1) create_space_with_book(): Bir space (Ev/İşletme) oluşturma İKİ ayrı
-- tabloya (spaces + books) yazma gerektiriyordu. Bunu tek bir SECURITY
-- DEFINER fonksiyonda birleştirmek, istemcinin iki ayrı ağ isteği arasında
-- (ör. bağlantı kopması) "defter'siz kalmış bir alan" gibi tutarsız bir ara
-- duruma düşme riskini ortadan kaldırır. owner_user_id parametre olarak
-- ALINMAZ, her zaman auth.uid() kullanılır — başkası adına alan açma
-- girişimini yapısal olarak imkansız kılar.
--
-- (2) profiles.theme_preference: Tema tercihinin yalnızca localStorage'da
-- değil, kullanıcı hesabında (sunucu tarafında) saklanması için.

alter table public.profiles
  add column if not exists theme_preference text not null default 'system'
  check (theme_preference in ('light', 'dark', 'system'));

comment on column public.profiles.theme_preference is
  'Kullanıcının tema tercihi. "system" ise istemci, cihazın sistem temasını '
  'izler. localStorage yalnızca anlık/optimistik önbellek olarak kullanılır — '
  'kalıcı kaynak burasıdır.';

create or replace function public.create_space_with_book(
  p_type text,
  p_name text,
  p_currency text default 'TRY'
)
returns table (space_id uuid, book_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_book_id uuid;
begin
  if p_type not in ('home', 'business') then
    raise exception 'type "home" veya "business" olmalidir';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name bos olamaz';
  end if;

  insert into public.spaces (owner_user_id, type, name)
  values (auth.uid(), p_type, trim(p_name))
  returning id into v_space_id;
  -- handle_new_space trigger'ı (0003) sahibi otomatik olarak
  -- space_members'e owner rolüyle ekler.

  insert into public.books (space_id, currency)
  values (v_space_id, p_currency)
  returning id into v_book_id;

  return query select v_space_id, v_book_id;
end;
$$;

comment on function public.create_space_with_book is
  'Ev veya İşletme alanını + ilk defterini tek çağrıda, tek veritabanı '
  'işleminde atomik oluşturur. owner_user_id her zaman auth.uid()''dir '
  '(parametre olarak alınmaz) — başkası adına alan açılamaz. Kullanıcı '
  'başına 1 Ev alanı kısıtı (spaces_one_home_per_user) burada da geçerlidir; '
  'ihlal edilirse veritabanı hatası döner.';

revoke all on function public.create_space_with_book(text, text, text) from public;
grant execute on function public.create_space_with_book(text, text, text) to authenticated;
