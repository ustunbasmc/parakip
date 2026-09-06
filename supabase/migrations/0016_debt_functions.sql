-- 0016_debt_functions.sql
-- Amaç: debts/debt_payments üzerindeki TÜM yazma işlemlerini atomik,
-- yetki kontrollü ve audit_log'a yazan fonksiyonlar üzerinden yapmak.
--
-- NOT (update_debt hakkında): p_counterparty_name/p_due_date/p_note
-- parametreleri "değişiklik yok" anlamına gelen bir NULL kabul ETMEZ —
-- her çağrı bu üç alanın TAMAMINI günceller (tam güncelleme semantiği).
-- Bu, "NULL = değiştirme" ile "NULL = alanı boşalt" belirsizliğini
-- ortadan kaldırmak için bilinçli bir tasarım kararıdır; çağıran taraf
-- değiştirmek istemediği alanlar için mevcut değeri geri göndermelidir.

-- ─────────────────────────────────────────────
-- create_debt
-- ─────────────────────────────────────────────

create or replace function public.create_debt(
  p_book_id uuid,
  p_counterparty_name text,
  p_direction text,
  p_principal_cents bigint,
  p_due_date date default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt_id uuid;
begin
  if p_direction not in ('payable', 'receivable') then
    raise exception 'direction "payable" veya "receivable" olmalidir';
  end if;

  if p_principal_cents is null or p_principal_cents <= 0 then
    raise exception 'principal_cents pozitif olmalidir';
  end if;

  if p_counterparty_name is null or length(trim(p_counterparty_name)) = 0 then
    raise exception 'counterparty_name bos olamaz';
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  insert into public.debts (book_id, counterparty_name, direction, principal_cents, due_date, note)
  values (p_book_id, p_counterparty_name, p_direction, p_principal_cents, p_due_date, p_note)
  returning id into v_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (
    p_book_id, auth.uid(), 'created', 'debt', v_debt_id,
    jsonb_build_object(
      'counterparty_name', p_counterparty_name, 'direction', p_direction,
      'principal_cents', p_principal_cents, 'due_date', p_due_date, 'note', p_note
    )
  );

  return v_debt_id;
end;
$$;

comment on function public.create_debt is
  'Borç/alacak kaydını header + audit_log ile tek veritabanı işleminde '
  'atomik oluşturur. direction: payable (ödeyeceğimiz) / receivable (alacağımız).';

revoke all on function public.create_debt(uuid, text, text, bigint, date, text) from public;
grant execute on function public.create_debt(uuid, text, text, bigint, date, text) to authenticated;

-- ─────────────────────────────────────────────
-- update_debt
-- ─────────────────────────────────────────────

create or replace function public.update_debt(
  p_debt_id uuid,
  p_counterparty_name text,
  p_due_date date,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
  v_before jsonb;
begin
  select book_id, status,
         jsonb_build_object('counterparty_name', counterparty_name, 'due_date', due_date, 'note', note)
    into v_book_id, v_status, v_before
  from public.debts
  where id = p_debt_id;

  if v_book_id is null then
    raise exception 'Borc bulunamadi (id=%)', p_debt_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Iptal edilmis bir borc guncellenemez';
  end if;

  if p_counterparty_name is null or length(trim(p_counterparty_name)) = 0 then
    raise exception 'counterparty_name bos olamaz';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  update public.debts
  set counterparty_name = p_counterparty_name,
      due_date = p_due_date,
      note = p_note
  where id = p_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'debt', p_debt_id, v_before,
    jsonb_build_object('counterparty_name', p_counterparty_name, 'due_date', p_due_date, 'note', p_note)
  );
end;
$$;

comment on function public.update_debt is
  'debts üzerinde YALNIZCA counterparty_name/due_date/note günceller '
  '(book_id/direction/principal_cents zaten trigger seviyesinde korumalı). '
  'Tam güncelleme semantiği: her üç parametre her çağrıda yeniden yazılır.';

revoke all on function public.update_debt(uuid, text, date, text) from public;
grant execute on function public.update_debt(uuid, text, date, text) to authenticated;

-- ─────────────────────────────────────────────
-- cancel_debt
-- ─────────────────────────────────────────────

create or replace function public.cancel_debt(p_debt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
begin
  select book_id, status into v_book_id, v_status
  from public.debts
  where id = p_debt_id;

  if v_book_id is null then
    raise exception 'Borc bulunamadi (id=%)', p_debt_id;
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Bu borc zaten iptal edilmis';
  end if;

  if v_status = 'paid' then
    raise exception 'Tamamen odenmis bir borc iptal edilemez';
  end if;

  update public.debts
  set status = 'cancelled'
  where id = p_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'cancelled', 'debt', p_debt_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'cancelled')
  );
end;
$$;

comment on function public.cancel_debt is
  'Bir borcu iptal eder. Yalnızca owner/admin çağırabilir. status=paid ise '
  'reddedilir (tamamen ödenmiş bir borç iptal değil, kapanmış sayılır).';

revoke all on function public.cancel_debt(uuid) from public;
grant execute on function public.cancel_debt(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- create_debt_payment
-- ─────────────────────────────────────────────

create or replace function public.create_debt_payment(
  p_debt_id uuid,
  p_amount_cents bigint,
  p_paid_at timestamptz default now(),
  p_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
  v_principal bigint;
  v_paid_so_far bigint;
  v_payment_id uuid;
begin
  select book_id, status, principal_cents
    into v_book_id, v_status, v_principal
  from public.debts
  where id = p_debt_id;

  if v_book_id is null then
    raise exception 'Borc bulunamadi (id=%)', p_debt_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Iptal edilmis bir borca odeme eklenemez';
  end if;

  if v_status = 'paid' then
    raise exception 'Bu borc zaten tamamen odenmis';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_cents pozitif olmalidir';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  -- Fazla ödeme kontrolü (erken, anlamlı hata mesajı için). Gerçek
  -- güvenlik ağı after_debt_payment_change trigger'ıdır — bu kontrol
  -- kaldırılsa/atlanılsa bile trigger yine de reddedecektir.
  select coalesce(sum(amount_cents), 0) into v_paid_so_far
  from public.debt_payments
  where debt_id = p_debt_id
    and status = 'active';

  if v_paid_so_far + p_amount_cents > v_principal then
    raise exception
      'Fazla odeme: kalan tutar % iken % odenmeye calisiliyor',
      (v_principal - v_paid_so_far), p_amount_cents;
  end if;

  -- İsteğe bağlı hesap hareketi ilişkilendirmesi: verilmişse, aktif
  -- olmalı VE bu borcun defteriyle ilişkili en az bir entry içermelidir
  -- (rastgele/ilgisiz bir transaction'a bağlanmayı engeller).
  if p_transaction_id is not null then
    if not public.is_transaction_active(p_transaction_id) then
      raise exception 'Verilen transaction_id aktif degil veya bulunamadi';
    end if;

    if not exists (
      select 1 from public.transaction_entries te
      where te.transaction_id = p_transaction_id
        and te.book_id = v_book_id
    ) then
      raise exception 'Verilen transaction_id bu defterle iliskili degil';
    end if;
  end if;

  insert into public.debt_payments (debt_id, amount_cents, paid_at, transaction_id)
  values (p_debt_id, p_amount_cents, p_paid_at, p_transaction_id)
  returning id into v_payment_id;
  -- Bu INSERT, after_debt_payment_change trigger'ını tetikler:
  -- debts.status otomatik olarak yeniden hesaplanır (open/partial/paid).

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'debt_payment', v_payment_id,
    jsonb_build_object(
      'debt_id', p_debt_id, 'amount_cents', p_amount_cents,
      'paid_at', p_paid_at, 'transaction_id', p_transaction_id
    )
  );

  return v_payment_id;
end;
$$;

comment on function public.create_debt_payment is
  'Bir borca kısmi/tam ödeme kaydı ekler; debt_payments + audit_log''u tek '
  'veritabanı işleminde atomik yazar. debts.status, after_debt_payment_change '
  'trigger''ı ile otomatik yeniden hesaplanır. Fazla ödeme REDDEDİLİR '
  '(hem burada hem trigger''da, çift güvenlik ağı).';

revoke all on function public.create_debt_payment(uuid, bigint, timestamptz, uuid) from public;
grant execute on function public.create_debt_payment(uuid, bigint, timestamptz, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- cancel_debt_payment
-- ─────────────────────────────────────────────

create or replace function public.cancel_debt_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt_id uuid;
  v_book_id uuid;
  v_status text;
begin
  select dp.debt_id, d.book_id, dp.status
    into v_debt_id, v_book_id, v_status
  from public.debt_payments dp
  join public.debts d on d.id = dp.debt_id
  where dp.id = p_payment_id;

  if v_debt_id is null then
    raise exception 'Odeme bulunamadi (id=%)', p_payment_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Bu odeme zaten iptal edilmis';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  update public.debt_payments
  set status = 'cancelled'
  where id = p_payment_id;
  -- after_debt_payment_change trigger'ı, borcun statusunu otomatik
  -- olarak geri hesaplar (ör. paid -> partial, partial -> open).

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'cancelled', 'debt_payment', p_payment_id,
    jsonb_build_object('status', 'active'), jsonb_build_object('status', 'cancelled')
  );
end;
$$;

comment on function public.cancel_debt_payment is
  'Bir ödeme kaydını iptal eder (owner/admin). debts.status otomatik olarak '
  'geri hesaplanır. Ödemenin kendisi silinmez, yalnızca status=cancelled olur.';

revoke all on function public.cancel_debt_payment(uuid) from public;
grant execute on function public.cancel_debt_payment(uuid) to authenticated;
