-- 0012_update_can_cancel_transaction_starter_check.sql
-- Amaç: D11'in eksik kalan ikinci şartını kapatmak — cross-book
-- transferde iptal yetkisi artık YALNIZCA "her iki defterde de
-- owner/admin" ile sınırlı değil, EK OLARAK "transferi başlatan kişi"
-- olma şartını da arar. Aynı defter içi işlemlerde (tek book_id) bu ek
-- şart aranmaz — yalnızca rol yeterlidir (D11'in ilk cümlesi).
--
-- "Başlatan" bilgisi audit_log'dan okunur: o transaction_id için en
-- erken 'created' kaydının actor_user_id'si.

create or replace function public.can_cancel_transaction(p_transaction_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_distinct_book_count int;
  v_all_roles_ok boolean;
  v_starter_id uuid;
begin
  select count(distinct book_id) into v_distinct_book_count
  from public.transaction_entries
  where transaction_id = p_transaction_id;

  select coalesce(
    bool_and(public.has_book_role(book_id, array['owner', 'admin'])),
    false
  )
  into v_all_roles_ok
  from (
    select distinct book_id
    from public.transaction_entries
    where transaction_id = p_transaction_id
  ) as distinct_books;

  -- Rol şartı sağlanmıyorsa (herhangi bir defterde owner/admin değilse)
  -- başka bir şey kontrol etmeye gerek yok, doğrudan reddedilir.
  if not v_all_roles_ok then
    return false;
  end if;

  -- Aynı defter içi işlem (tek book_id): yalnızca rol yeterli.
  if v_distinct_book_count <= 1 then
    return true;
  end if;

  -- Cross-book (birden fazla book_id): EK OLARAK başlatan olma şartı.
  select actor_user_id into v_starter_id
  from public.audit_log
  where transaction_id = p_transaction_id
    and action = 'created'
  order by created_at asc
  limit 1;

  return v_starter_id is not null and v_starter_id = auth.uid();
end;
$$;

comment on function public.can_cancel_transaction is
  'D11: Aynı defter işleminde (tek book_id) tek deftere ait owner/admin rolü '
  'yeterlidir. Cross-book işlemde (birden fazla book_id) EK OLARAK çağıranın '
  'transferi başlatan kişi olması da şarttır (audit_log''daki en erken '
  '"created" kaydının actor_user_id''si ile karşılaştırılır). Yalnızca bir '
  'tarafta yetkili olan veya başlatmayan kullanıcı iptal edemez — bunun yerine '
  'ters transfer (create_transfer ile tersine yön) oluşturmalıdır.';
