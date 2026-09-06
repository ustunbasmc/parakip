-- 0036_cancel_holding_transaction.sql
-- Amaç: Bir alış/satışı atomik olarak iptal etmek — bağlı ledger işlemi,
-- holding'in miktar/maliyet tabanı/gerçekleşmiş kâr-zararı BİRLİKTE geri
-- hesaplanır. Fiziksel silme YOK; status=cancelled + audit_log kullanılır.
--
-- LIFO KISITI: Yalnızca o holding üzerindeki EN SON aktif işlem iptal
-- edilebilir (bkz. 0034'teki gerekçe). "En son", occurred_at (kullanıcının
-- girdiği, geçmişe dönük olabilen bir tarih) DEĞİL, created_at (işlemin
-- veritabanına GERÇEKTEN uygulandığı an) ile belirlenir — çünkü tersine
-- çevirme mantığı, hangi delta'nın holdings üzerine EN SON uygulandığına
-- bağlıdır, kullanıcının o işleme hangi tarihi etiketlediğine değil.

create or replace function public.cancel_holding_transaction(p_holding_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_holding_id uuid;
  v_status text;
  v_type text;
  v_quantity numeric;
  v_price_cents bigint;
  v_realized_gain_cents bigint;
  v_transaction_id uuid;
  v_latest_id uuid;
  v_holding_quantity numeric;
  v_holding_cost_basis bigint;
  v_asset_amount_cents bigint;
  v_new_quantity numeric;
  v_new_cost_basis bigint;
begin
  select ht.holding_id, ht.status, ht.type, ht.quantity, ht.price_cents,
         ht.realized_gain_cents, ht.transaction_id, p.book_id
    into v_holding_id, v_status, v_type, v_quantity, v_price_cents,
         v_realized_gain_cents, v_transaction_id, v_book_id
  from public.holding_transactions ht
  join public.holdings h on h.id = ht.holding_id
  join public.portfolios p on p.id = h.portfolio_id
  where ht.id = p_holding_transaction_id;

  if v_holding_id is null then
    raise exception 'Islem bulunamadi (id=%)', p_holding_transaction_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Bu islem zaten iptal edilmis';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  -- LIFO KISITI.
  select id into v_latest_id
  from public.holding_transactions
  where holding_id = v_holding_id
    and status = 'active'
  order by created_at desc
  limit 1;

  if v_latest_id <> p_holding_transaction_id then
    raise exception
      'Yalnizca bu varlik uzerindeki EN SON islem iptal edilebilir (LIFO). '
      'Once daha sonraki islemleri iptal edin (id=%)', v_latest_id;
  end if;

  select quantity, total_cost_basis_cents
    into v_holding_quantity, v_holding_cost_basis
  from public.holdings
  where id = v_holding_id;

  -- Varlığın KENDİ para biriminde tutar (hangi hesaptan/kurdan ödendiğinden
  -- bağımsız) — quantity*price_cents her zaman güvenilir kaynaktır.
  v_asset_amount_cents := round(v_quantity * v_price_cents)::bigint;

  if v_type = 'buy' then
    v_new_quantity := v_holding_quantity - v_quantity;
    v_new_cost_basis := v_holding_cost_basis - v_asset_amount_cents;

    if v_new_quantity < 0 or v_new_cost_basis < 0 then
      raise exception
        'Iptal, holding degerlerini gecersiz kilardi (beklenmeyen tutarsizlik, holding_id=%)', v_holding_id;
    end if;

    update public.holdings
    set quantity = v_new_quantity,
        total_cost_basis_cents = v_new_cost_basis
    where id = v_holding_id;

  else -- sell
    -- cost_of_sold_cents, satış anında kaydedilen realized_gain_cents'ten
    -- geriye doğru türetilir: realized_gain = proceeds - cost_of_sold
    -- => cost_of_sold = proceeds - realized_gain. Bu, tam satışta özel
    -- (kalan tüm tabanı kullanan) durumu da doğru şekilde geri getirir.
    declare
      v_cost_of_sold_cents bigint;
    begin
      v_cost_of_sold_cents := v_asset_amount_cents - v_realized_gain_cents;
      v_new_quantity := v_holding_quantity + v_quantity;
      v_new_cost_basis := v_holding_cost_basis + v_cost_of_sold_cents;

      update public.holdings
      set quantity = v_new_quantity,
          total_cost_basis_cents = v_new_cost_basis,
          realized_gain_cents = realized_gain_cents - v_realized_gain_cents
      where id = v_holding_id;
    end;
  end if;

  -- Bağlı ledger işlemini iptal et — nakit etkisi geri alınır. Bu,
  -- transactions_enforce_cancel_only trigger'ını tetikler (status
  -- dışında hiçbir alan değişmez, cancelled_at otomatik set edilir).
  update public.transactions set status = 'cancelled' where id = v_transaction_id;

  -- holding_transactions'ı iptal et (bu, kendi cancel-only trigger'ını
  -- tetikler).
  update public.holding_transactions
  set status = 'cancelled'
  where id = p_holding_transaction_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, before, after)
  values (
    v_book_id, auth.uid(), 'cancelled', 'holding_transaction', p_holding_transaction_id, v_transaction_id,
    jsonb_build_object('status', 'active', 'type', v_type, 'quantity', v_quantity),
    jsonb_build_object('status', 'cancelled')
  );
end;
$$;

comment on function public.cancel_holding_transaction is
  'Bir alış/satışı iptal eder: bağlı ledger işlemi (nakit etkisi) iptal '
  'edilir, holdings.quantity/total_cost_basis_cents/realized_gain_cents '
  'BİRLİKTE geri hesaplanır. Yalnızca owner/admin çağırabilir. YALNIZCA o '
  'holding üzerindeki EN SON aktif işlem iptal edilebilir (LIFO) — '
  'weighted-average modelde lot-bazlı izleme olmadığı için rastgele geçmiş '
  'işlem iptali tutarsızlık yaratabilir.';

revoke all on function public.cancel_holding_transaction(uuid) from public;
grant execute on function public.cancel_holding_transaction(uuid) to authenticated;
