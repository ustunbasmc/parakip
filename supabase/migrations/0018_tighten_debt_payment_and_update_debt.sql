-- 0018_tighten_debt_payment_and_update_debt.sql
-- Amaç:
-- (1) create_debt_payment(): transaction_entry_id verildiğinde tutar VE
--     yön eşleşmesini zorunlu kılmak; farklı tutar, yanlış yön, başka
--     deftere/borca ait veya tekrar kullanılan entry'leri reddetmek.
-- (2) update_debt(): güvenli partial update — bir alanı "değiştirme"
--     ile "bilerek boşalt" arasındaki farkı ayıran açık bayraklarla.

-- ─────────────────────────────────────────────
-- create_debt_payment — parametre TİPLERİ aynı kalsa da son parametrenin
-- ADI değişti (p_transaction_id -> p_transaction_entry_id); PostgreSQL
-- CREATE OR REPLACE ile parametre adı değişikliğine izin vermediği için
-- önce eski imza açıkça DROP edilir.
-- ─────────────────────────────────────────────

drop function if exists public.create_debt_payment(uuid, bigint, timestamptz, uuid);

create or replace function public.create_debt_payment(
  p_debt_id uuid,
  p_amount_cents bigint,
  p_paid_at timestamptz default now(),
  p_transaction_entry_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
  v_direction text;
  v_principal bigint;
  v_paid_so_far bigint;
  v_payment_id uuid;
  v_entry_book_id uuid;
  v_entry_amount bigint;
  v_expected_amount bigint;
  v_payment_id_found uuid;
begin
  select book_id, status, direction, principal_cents
    into v_book_id, v_status, v_direction, v_principal
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

  select coalesce(sum(amount_cents), 0) into v_paid_so_far
  from public.debt_payments
  where debt_id = p_debt_id
    and status = 'active';

  if v_paid_so_far + p_amount_cents > v_principal then
    raise exception
      'Fazla odeme: kalan tutar % iken % odenmeye calisiliyor',
      (v_principal - v_paid_so_far), p_amount_cents;
  end if;

  -- ── Hesap hareketi ile tutarlılık kontrolü (yalnızca verilmişse) ──
  if p_transaction_entry_id is not null then
    select te.book_id, te.amount_cents
      into v_entry_book_id, v_entry_amount
    from public.transaction_entries te
    join public.transactions t on t.id = te.transaction_id
    where te.id = p_transaction_entry_id
      and t.status = 'active';

    if v_entry_book_id is null then
      raise exception 'Verilen transaction_entry_id aktif degil veya bulunamadi';
    end if;

    if v_entry_book_id <> v_book_id then
      raise exception 'Verilen hesap hareketi bu borcun defteriyle iliskili degil';
    end if;

    -- YÖN KURALI: receivable (alacak) -> hesaba giren PARA (pozitif),
    -- payable (borç) -> hesaptan cikan PARA (negatif). Beklenen isaretli
    -- tutar, tam olarak entry'nin tutarina esit olmalidir (hem buyukluk
    -- hem yon aynı anda dogrulanir).
    v_expected_amount := case
      when v_direction = 'receivable' then p_amount_cents
      else -p_amount_cents
    end;

    if v_entry_amount <> v_expected_amount then
      raise exception
        'Hesap hareketi tutari/yonu borc ile uyusmuyor: beklenen % (direction=%), hareketin tutari %',
        v_expected_amount, v_direction, v_entry_amount;
    end if;

    -- TEKRAR KULLANIM ENGELİ: erken, anlamlı hata mesajı için (gerçek
    -- güvenlik ağı debt_payments_transaction_entry_unique kısıtıdır —
    -- bu kontrol atlansa/kaldırılsa bile kısıt yine reddedecektir).
    select id into v_payment_id_found
    from public.debt_payments
    where transaction_entry_id = p_transaction_entry_id
      and status = 'active'
    limit 1;

    if v_payment_id_found is not null then
      raise exception
        'Bu hesap hareketi zaten baska bir aktif odemede kullanilmis (debt_payment id=%)',
        v_payment_id_found;
    end if;
  end if;

  insert into public.debt_payments (debt_id, amount_cents, paid_at, transaction_entry_id)
  values (p_debt_id, p_amount_cents, p_paid_at, p_transaction_entry_id)
  returning id into v_payment_id;
  -- Bu INSERT iki güvenlik agini birden tetikler:
  --  (a) debt_payments_transaction_entry_unique -> tekrar kullanim varsa REDDEDER
  --  (b) after_debt_payment_change trigger -> fazla odeme varsa REDDEDER,
  --      yoksa debts.status'u yeniden hesaplar.

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'debt_payment', v_payment_id,
    jsonb_build_object(
      'debt_id', p_debt_id, 'amount_cents', p_amount_cents, 'paid_at', p_paid_at,
      'transaction_entry_id', p_transaction_entry_id,
      'is_external', p_transaction_entry_id is null
    )
  );

  return v_payment_id;
end;
$$;

comment on function public.create_debt_payment is
  'Bir borca ödeme ekler. p_transaction_entry_id verilirse: (1) aktif olmali, '
  '(2) borcun defteriyle ayni book_id''de olmali, (3) tutari/yonu borcun '
  'direction''i ile TAM eslesmeli (payable->negatif, receivable->pozitif), '
  '(4) baska aktif bir odeme tarafindan zaten kullanilmamis olmali. Hicbiri '
  'verilmezse odeme is_external=true olarak (harici/manuel) kaydedilir.';

revoke all on function public.create_debt_payment(uuid, bigint, timestamptz, uuid) from public;
grant execute on function public.create_debt_payment(uuid, bigint, timestamptz, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- update_debt — GÜVENLİ PARTIAL UPDATE
-- Eski imza (uuid, text, date, text) "tam güncelleme" semantiğine
-- sahipti ve NULL göndermek yanlışlıkla alanı boşaltabiliyordu.
-- Yeni imza farklı bir parametre listesi (overload) olduğu için eski
-- fonksiyon önce açıkça DROP edilir.
-- ─────────────────────────────────────────────

drop function if exists public.update_debt(uuid, text, date, text);

create or replace function public.update_debt(
  p_debt_id uuid,
  p_counterparty_name text default null,   -- NULL = degistirme (alan asla null olamaz zaten)
  p_due_date date default null,            -- NULL + p_clear_due_date=false = degistirme
  p_clear_due_date boolean default false,  -- true = due_date'i bilerek NULL yap
  p_note text default null,                -- NULL + p_clear_note=false = degistirme
  p_clear_note boolean default false       -- true = note'u bilerek NULL yap
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
  v_new_counterparty text;
  v_new_due_date date;
  v_new_note text;
begin
  select book_id, status, counterparty_name, due_date, note
    into v_book_id, v_status, v_new_counterparty, v_new_due_date, v_new_note
  from public.debts
  where id = p_debt_id;

  if v_book_id is null then
    raise exception 'Borc bulunamadi (id=%)', p_debt_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Iptal edilmis bir borc guncellenemez';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  v_before := jsonb_build_object(
    'counterparty_name', v_new_counterparty, 'due_date', v_new_due_date, 'note', v_new_note
  );

  -- counterparty_name: NOT NULL bir alan oldugu icin NULL parametre
  -- her zaman "degistirme" anlamina gelir, ayri bir clear bayragina
  -- gerek yoktur.
  if p_counterparty_name is not null then
    if length(trim(p_counterparty_name)) = 0 then
      raise exception 'counterparty_name bos olamaz';
    end if;
    v_new_counterparty := p_counterparty_name;
  end if;

  if p_clear_due_date then
    v_new_due_date := null;
  elsif p_due_date is not null then
    v_new_due_date := p_due_date;
  end if;

  if p_clear_note then
    v_new_note := null;
  elsif p_note is not null then
    v_new_note := p_note;
  end if;

  update public.debts
  set counterparty_name = v_new_counterparty,
      due_date = v_new_due_date,
      note = v_new_note
  where id = p_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'debt', p_debt_id, v_before,
    jsonb_build_object('counterparty_name', v_new_counterparty, 'due_date', v_new_due_date, 'note', v_new_note)
  );
end;
$$;

comment on function public.update_debt is
  'GÜVENLİ PARTIAL UPDATE: bir alanı değiştirmemek için parametreyi NULL '
  'bırakmak yeterlidir (mevcut değer korunur). due_date/note''u BİLEREK '
  'NULL''a çekmek için p_clear_due_date/p_clear_note=true gönderilmelidir — '
  'yalnızca NULL göndermek bu iki alanı ASLA boşaltmaz.';

revoke all on function public.update_debt(uuid, text, date, boolean, text, boolean) from public;
grant execute on function public.update_debt(uuid, text, date, boolean, text, boolean) to authenticated;
