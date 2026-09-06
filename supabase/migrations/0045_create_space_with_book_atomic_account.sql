-- 0045_create_space_with_book_atomic_account.sql
-- Amaç: create_space_with_book()'u GENİŞLETMEK — sektör ve isteğe bağlı
-- varsayılan "Kasa" hesabı artık AYNI fonksiyon/AYNI veritabanı işlemi
-- içinde, tek seferde atomik olarak yazılıyor. Kasa hesabı oluşturma
-- (ör. negatif tutar CHECK kısıtına takılırsa) BAŞARISIZ olursa, PL/pgSQL
-- fonksiyonu içindeki exception tüm transaction'ı (space + book + varsa
-- account) GERİ ALIR — ayrı, atomik-olmayan bir INSERT adımına artık
-- gerek yok.
--
-- Dönüş tipi DEĞİŞTİĞİ (account_id eklendi) için CREATE OR REPLACE
-- yetmez — mevcut 3 parametreli imza önce DROP edilir. Mevcut çağıran
-- kod (onboarding akışı) yeni parametreleri HİÇ GEÇMEDİĞİ için (hepsi
-- varsayılan değerli) davranışı birebir aynı kalır; yalnızca dönen
-- satıya fazladan bir `account_id` sütunu (o çağrılarda hep NULL) eklenmiş
-- olur, bu da PostgREST/TS tarafında zararsızdır.

drop function if exists public.create_space_with_book(text, text, text);

create or replace function public.create_space_with_book(
  p_type text,
  p_name text,
  p_currency text default 'TRY',
  p_sector text default null,
  p_create_default_account boolean default false,
  p_default_account_opening_balance_cents bigint default 0
)
returns table (space_id uuid, book_id uuid, account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
  v_book_id uuid;
  v_account_id uuid;
begin
  if p_type not in ('home', 'business') then
    raise exception 'type "home" veya "business" olmalidir';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name bos olamaz';
  end if;

  if p_sector is not null and p_type <> 'business' then
    raise exception 'sector yalnizca type=business icin gecerlidir';
  end if;

  insert into public.spaces (owner_user_id, type, name, sector)
  values (auth.uid(), p_type, trim(p_name), p_sector)
  returning id into v_space_id;
  -- handle_new_space trigger'ı (0003) sahibi otomatik olarak
  -- space_members'e owner rolüyle ekler.

  insert into public.books (space_id, currency)
  values (v_space_id, p_currency)
  returning id into v_book_id;

  if p_create_default_account then
    -- accounts_negative_opening_balance_credit_card_only (0041) kısıtı
    -- burada da geçerlidir: type='cash' olduğu için negatif bir açılış
    -- bakiyesi verilirse bu INSERT başarısız olur ve TÜM fonksiyon
    -- (space + book dahil) geri alınır — istenen atomik davranış budur.
    insert into public.accounts (book_id, name, type, currency, opening_balance_cents)
    values (v_book_id, 'Kasa', 'cash', p_currency, p_default_account_opening_balance_cents)
    returning id into v_account_id;
  end if;

  return query select v_space_id, v_book_id, v_account_id;
end;
$$;

comment on function public.create_space_with_book is
  'Ev veya İşletme alanını + defterini, isteğe bağlı olarak sektörünü ve '
  'varsayılan bir Kasa hesabını TEK ve ATOMİK bir veritabanı işleminde '
  'oluşturur. owner_user_id her zaman auth.uid()''dir. Kasa hesabı '
  'oluşturma başarısız olursa (ör. negatif açılış bakiyesi) TÜM işlem '
  '(space + book dahil) geri alınır.';

revoke all on function public.create_space_with_book(text, text, text, text, boolean, bigint) from public;
grant execute on function public.create_space_with_book(text, text, text, text, boolean, bigint) to authenticated;
