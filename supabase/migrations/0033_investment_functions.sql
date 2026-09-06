-- 0033_investment_functions.sql
-- Amaç: Alış/satış işlemlerini, nakit bacağı + holding güncellemesi +
-- audit_log ile TEK veritabanı işleminde atomik olarak yapan fonksiyonlar,
-- ve piyasa verisi yazma fonksiyonu (yalnızca service_role).
--
-- MİMARİ NOT: create_investment_buy/sell, nakit bacağını KENDİSİ yazmaz —
-- zaten var olan, test edilmiş, audit'lenen create_simple_transaction()
-- fonksiyonunu İÇERİDEN çağırır. Bu, "alış/satış işlemleri mevcut
-- finansal çekirdeğe atomik şekilde bağlansın" kuralını, kod tekrarı
-- olmadan, tek bir PL/pgSQL fonksiyon çağrısı (=tek DB işlemi) içinde
-- doğal olarak sağlar.

-- ─────────────────────────────────────────────
-- create_investment_buy
-- ─────────────────────────────────────────────

create or replace function public.create_investment_buy(
  p_portfolio_id uuid,
  p_asset_symbol text,
  p_asset_type text,
  p_quantity numeric,
  p_price_cents bigint,
  p_cash_account_id uuid,
  p_currency text default 'TRY',
  p_occurred_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_total_cash_cents bigint;
  v_transaction_id uuid;
  v_holding_id uuid;
  v_holding_tx_id uuid;
begin
  select book_id into v_book_id from public.portfolios where id = p_portfolio_id;
  if v_book_id is null then
    raise exception 'Portfoy bulunamadi (id=%)', p_portfolio_id;
  end if;

  if p_asset_type not in ('bist', 'us_stock', 'gold', 'fx', 'crypto') then
    raise exception 'Gecersiz asset_type: %', p_asset_type;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity pozitif olmalidir';
  end if;

  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'price_cents pozitif olmalidir';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', v_book_id;
  end if;

  v_total_cash_cents := round(p_quantity * p_price_cents)::bigint;

  if v_total_cash_cents <= 0 then
    raise exception 'Hesaplanan toplam tutar gecersiz: %', v_total_cash_cents;
  end if;

  -- Nakit bacağı: alış, ilgili hesabı AZALTIR (expense, mevcut finansal
  -- çekirdek fonksiyonu üzerinden — atomiklik ve audit otomatik gelir).
  v_transaction_id := public.create_simple_transaction(
    p_book_id => v_book_id,
    p_account_id => p_cash_account_id,
    p_type => 'expense',
    p_amount_cents => -v_total_cash_cents,
    p_note => p_note,
    p_occurred_at => p_occurred_at
  );

  select id into v_holding_id
  from public.holdings
  where portfolio_id = p_portfolio_id
    and asset_symbol = p_asset_symbol
    and asset_type = p_asset_type;

  if not found then
    insert into public.holdings (portfolio_id, asset_symbol, asset_type, currency, quantity, total_cost_basis_cents)
    values (p_portfolio_id, p_asset_symbol, p_asset_type, p_currency, 0, 0)
    returning id into v_holding_id;
  end if;

  -- WEIGHTED AVERAGE: toplam maliyet tabanına yeni alışın tutarı eklenir;
  -- birim başına ortalama hiç saklanmaz, gerektiğinde türetilir.
  update public.holdings
  set quantity = quantity + p_quantity,
      total_cost_basis_cents = total_cost_basis_cents + v_total_cash_cents
  where id = v_holding_id;

  insert into public.holding_transactions
    (holding_id, transaction_id, type, quantity, price_cents, occurred_at)
  values
    (v_holding_id, v_transaction_id, 'buy', p_quantity, p_price_cents, p_occurred_at)
  returning id into v_holding_tx_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'holding_transaction', v_holding_tx_id, v_transaction_id,
    jsonb_build_object(
      'holding_id', v_holding_id, 'type', 'buy', 'asset_symbol', p_asset_symbol,
      'quantity', p_quantity, 'price_cents', p_price_cents, 'total_cash_cents', v_total_cash_cents
    )
  );

  return v_holding_tx_id;
end;
$$;

comment on function public.create_investment_buy is
  'Yatırım alışı: nakit hesabından tutar düşer (create_simple_transaction '
  'ile expense), holding''in quantity''si ve total_cost_basis_cents''i '
  'artar (weighted average), holding_transactions + audit_log yazılır — '
  'hepsi tek veritabanı işleminde atomik.';

revoke all on function public.create_investment_buy(
  uuid, text, text, numeric, bigint, uuid, text, timestamptz, text
) from public;
grant execute on function public.create_investment_buy(
  uuid, text, text, numeric, bigint, uuid, text, timestamptz, text
) to authenticated;

-- ─────────────────────────────────────────────
-- create_investment_sell
-- ─────────────────────────────────────────────

create or replace function public.create_investment_sell(
  p_portfolio_id uuid,
  p_asset_symbol text,
  p_asset_type text,
  p_quantity numeric,
  p_price_cents bigint,
  p_cash_account_id uuid,
  p_occurred_at timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_holding_id uuid;
  v_holding_quantity numeric;
  v_holding_cost_basis bigint;
  v_avg_cost_per_unit numeric;
  v_cost_of_sold_cents bigint;
  v_proceeds_cents bigint;
  v_realized_gain_cents bigint;
  v_transaction_id uuid;
  v_holding_tx_id uuid;
begin
  select book_id into v_book_id from public.portfolios where id = p_portfolio_id;
  if v_book_id is null then
    raise exception 'Portfoy bulunamadi (id=%)', p_portfolio_id;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity pozitif olmalidir';
  end if;

  if p_price_cents is null or p_price_cents <= 0 then
    raise exception 'price_cents pozitif olmalidir';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', v_book_id;
  end if;

  select id, quantity, total_cost_basis_cents
    into v_holding_id, v_holding_quantity, v_holding_cost_basis
  from public.holdings
  where portfolio_id = p_portfolio_id
    and asset_symbol = p_asset_symbol
    and asset_type = p_asset_type;

  if v_holding_id is null then
    raise exception 'Bu varliktan elinizde hic yok (symbol=%, asset_type=%)', p_asset_symbol, p_asset_type;
  end if;

  -- FAZLA SATIŞ REDDİ (erken, anlamlı mesaj — gerçek güvenlik ağı
  -- holdings.quantity >= 0 CHECK kısıtıdır).
  if p_quantity > v_holding_quantity then
    raise exception
      'Fazla satis: elinizde % adet var, % adet satmaya calisiyorsunuz (symbol=%)',
      v_holding_quantity, p_quantity, p_asset_symbol;
  end if;

  v_avg_cost_per_unit := v_holding_cost_basis::numeric / v_holding_quantity;

  if p_quantity = v_holding_quantity then
    -- TAM SATIŞ: kalan maliyet tabanının TAMAMINI kullan — kesirli çarpımın
    -- yuvarlama hatasından dolayı total_cost_basis_cents'in eksiye
    -- düşmesini (CHECK ihlali) engeller. Satış sonrası kalan tam olarak 0.
    v_cost_of_sold_cents := v_holding_cost_basis;
  else
    v_cost_of_sold_cents := round(v_avg_cost_per_unit * p_quantity);
  end if;

  v_proceeds_cents := round(p_quantity * p_price_cents)::bigint;
  v_realized_gain_cents := v_proceeds_cents - v_cost_of_sold_cents;

  -- Nakit bacağı: satış, ilgili hesabı ARTIRIR (income).
  v_transaction_id := public.create_simple_transaction(
    p_book_id => v_book_id,
    p_account_id => p_cash_account_id,
    p_type => 'income',
    p_amount_cents => v_proceeds_cents,
    p_note => p_note,
    p_occurred_at => p_occurred_at
  );

  update public.holdings
  set quantity = quantity - p_quantity,
      total_cost_basis_cents = total_cost_basis_cents - v_cost_of_sold_cents,
      realized_gain_cents = realized_gain_cents + v_realized_gain_cents
  where id = v_holding_id;

  insert into public.holding_transactions
    (holding_id, transaction_id, type, quantity, price_cents, realized_gain_cents, occurred_at)
  values
    (v_holding_id, v_transaction_id, 'sell', p_quantity, p_price_cents, v_realized_gain_cents, p_occurred_at)
  returning id into v_holding_tx_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'holding_transaction', v_holding_tx_id, v_transaction_id,
    jsonb_build_object(
      'holding_id', v_holding_id, 'type', 'sell', 'asset_symbol', p_asset_symbol,
      'quantity', p_quantity, 'price_cents', p_price_cents, 'proceeds_cents', v_proceeds_cents,
      'cost_of_sold_cents', v_cost_of_sold_cents, 'realized_gain_cents', v_realized_gain_cents
    )
  );

  return v_holding_tx_id;
end;
$$;

comment on function public.create_investment_sell is
  'Yatırım satışı: nakit hesabına tutar eklenir (create_simple_transaction '
  'ile income), holding''in quantity''si ve total_cost_basis_cents''i '
  'AZALIR (weighted average maliyetle orantılı), gerçekleşmiş kâr/zarar '
  '(proceeds - cost_of_sold) hem bu işleme özgü (holding_transactions) hem '
  'kümülatif (holdings.realized_gain_cents) olarak ayrı tutulur. Elde '
  'olandan fazla satış REDDEDİLİR.';

revoke all on function public.create_investment_sell(
  uuid, text, text, numeric, bigint, uuid, timestamptz, text
) from public;
grant execute on function public.create_investment_sell(
  uuid, text, text, numeric, bigint, uuid, timestamptz, text
) to authenticated;

-- ─────────────────────────────────────────────
-- upsert_market_price — YALNIZCA service_role
-- ─────────────────────────────────────────────

create or replace function public.upsert_market_price(
  p_provider text,
  p_symbol text,
  p_asset_type text,
  p_currency text,
  p_price numeric,
  p_fetched_at timestamptz,
  p_latency_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_asset_type not in ('bist', 'us_stock', 'gold', 'fx', 'crypto') then
    raise exception 'Gecersiz asset_type: %', p_asset_type;
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'price pozitif olmalidir';
  end if;

  if p_fetched_at is null then
    raise exception 'fetched_at bos olamaz';
  end if;

  insert into public.market_prices_cache
    (provider, symbol, asset_type, currency, price, fetched_at, latency_seconds)
  values
    (p_provider, p_symbol, p_asset_type, p_currency, p_price, p_fetched_at, p_latency_seconds)
  on conflict (provider, symbol, asset_type)
  do update set
    currency = excluded.currency,
    price = excluded.price,
    fetched_at = excluded.fetched_at,
    latency_seconds = excluded.latency_seconds
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.upsert_market_price is
  'Piyasa fiyatını yazar/günceller. YALNIZCA service_role çağırabilir — '
  'normal kullanıcılar (authenticated) fiyat enjekte edemez. Sunucu '
  'tarafı piyasa veri adaptörü (sağlayıcıdan bağımsız katman) bu fonksiyonu '
  'periyodik olarak çağırarak önbelleği tazeler.';

revoke all on function public.upsert_market_price(
  text, text, text, text, numeric, timestamptz, integer
) from public;
grant execute on function public.upsert_market_price(
  text, text, text, text, numeric, timestamptz, integer
) to service_role;
