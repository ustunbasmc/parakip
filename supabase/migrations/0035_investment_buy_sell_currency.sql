-- 0035_investment_buy_sell_currency.sql
-- Amaç: create_investment_buy/sell'e çoklu para birimi v1 kuralını
-- eklemek. Yeni parametreler SONA eklendi (varsayılan değerli), bu yüzden
-- CREATE OR REPLACE yeterli — mevcut çağıran kod (isimli parametre
-- kullandığı sürece) etkilenmez.
--
-- KURAL:
--   - Varlık para birimi (holdings.currency) = hesap para birimi
--     (accounts.currency) ise: doğrudan kabul, fx parametreleri
--     gönderilMEmelidir (gönderilirse reddedilir).
--   - Farklıysa: fx_rate, fx_rate_date, fx_rate_source,
--     converted_amount_cents alanlarının HEPSİ zorunludur; eksikse
--     REDDEDİLİR. converted_amount_cents, ledger nakit bacağı için
--     kullanılan OTORİTER tutardır (hesap para biriminde).
--   - Varlığın kendi maliyet tabanı/gerçekleşmiş kâr-zararı HER ZAMAN
--     kendi para biriminde (quantity*price_cents ile) hesaplanır —
--     hangi hesaptan ödendiğinden bağımsızdır. "Portföy toplamları para
--     birimi bazında gösterilir, otomatik toplam dönüşümü YAPILMAZ"
--     kuralı böylece doğal olarak sağlanır: her holding kendi para
--     biriminde tutarlı kalır, farklı para birimli holding'ler asla
--     tek bir sayıda toplanmaya çalışılmaz.

-- Eski (0033'teki) 9 parametreli imzalar, yeni 13 parametreli (fx alanları
-- eklenmiş) imzalarla değiştirileceği için önce açıkça DROP edilir —
-- CREATE OR REPLACE, parametre SAYISI değiştiğinde "aynı fonksiyon" kabul
-- ETMEZ; aksi halde iki overload bir arada kalır (belirsizlik yaratır).

drop function if exists public.create_investment_buy(
  uuid, text, text, numeric, bigint, uuid, text, timestamptz, text
);

create or replace function public.create_investment_buy(
  p_portfolio_id uuid,
  p_asset_symbol text,
  p_asset_type text,
  p_quantity numeric,
  p_price_cents bigint,
  p_cash_account_id uuid,
  p_currency text default 'TRY',
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_fx_rate numeric default null,
  p_fx_rate_date date default null,
  p_fx_rate_source text default null,
  p_converted_amount_cents bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_account_currency text;
  v_holding_currency text;
  v_asset_total_cents bigint;
  v_cash_leg_amount_cents bigint;
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

  select currency into v_account_currency from public.accounts where id = p_cash_account_id;
  if v_account_currency is null then
    raise exception 'Hesap bulunamadi (id=%)', p_cash_account_id;
  end if;

  select id, currency into v_holding_id, v_holding_currency
  from public.holdings
  where portfolio_id = p_portfolio_id
    and asset_symbol = p_asset_symbol
    and asset_type = p_asset_type;

  if not found then
    v_holding_currency := p_currency;
  end if;

  v_asset_total_cents := round(p_quantity * p_price_cents)::bigint;

  if v_asset_total_cents <= 0 then
    raise exception 'Hesaplanan toplam tutar gecersiz: %', v_asset_total_cents;
  end if;

  -- ── ÇOKLU PARA BİRİMİ KONTROLÜ ──
  if v_holding_currency = v_account_currency then
    if p_fx_rate is not null or p_fx_rate_date is not null
       or p_fx_rate_source is not null or p_converted_amount_cents is not null
    then
      raise exception
        'Ayni para biriminde (% ) islemlerde fx parametreleri gonderilmemelidir', v_holding_currency;
    end if;
    v_cash_leg_amount_cents := v_asset_total_cents;
  else
    if p_fx_rate is null or p_fx_rate_date is null
       or p_fx_rate_source is null or p_converted_amount_cents is null
    then
      raise exception
        'Farkli para birimlerinde islem icin fx_rate, fx_rate_date, fx_rate_source ve converted_amount_cents ZORUNLUDUR (varlik=%, hesap=%)',
        v_holding_currency, v_account_currency;
    end if;

    if p_fx_rate <= 0 then
      raise exception 'fx_rate pozitif olmalidir';
    end if;

    if p_converted_amount_cents <= 0 then
      raise exception 'converted_amount_cents pozitif olmalidir';
    end if;

    if p_fx_rate_source not in ('manual', 'provider') then
      raise exception 'fx_rate_source "manual" veya "provider" olmalidir';
    end if;

    v_cash_leg_amount_cents := p_converted_amount_cents;
  end if;

  -- Nakit bacağı: HESAP para biriminde, gerçekte hareket eden tutar.
  v_transaction_id := public.create_simple_transaction(
    p_book_id => v_book_id,
    p_account_id => p_cash_account_id,
    p_type => 'expense',
    p_amount_cents => -v_cash_leg_amount_cents,
    p_note => p_note,
    p_occurred_at => p_occurred_at
  );

  if v_holding_id is null then
    insert into public.holdings (portfolio_id, asset_symbol, asset_type, currency, quantity, total_cost_basis_cents)
    values (p_portfolio_id, p_asset_symbol, p_asset_type, v_holding_currency, 0, 0)
    returning id into v_holding_id;
  end if;

  -- Maliyet tabanı HER ZAMAN varlığın KENDİ para biriminde (v_asset_total_cents).
  update public.holdings
  set quantity = quantity + p_quantity,
      total_cost_basis_cents = total_cost_basis_cents + v_asset_total_cents
  where id = v_holding_id;

  insert into public.holding_transactions
    (holding_id, transaction_id, type, quantity, price_cents, occurred_at,
     fx_rate, fx_rate_date, fx_rate_source, converted_amount_cents)
  values
    (v_holding_id, v_transaction_id, 'buy', p_quantity, p_price_cents, p_occurred_at,
     p_fx_rate, p_fx_rate_date, p_fx_rate_source, p_converted_amount_cents)
  returning id into v_holding_tx_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'holding_transaction', v_holding_tx_id, v_transaction_id,
    jsonb_build_object(
      'holding_id', v_holding_id, 'type', 'buy', 'asset_symbol', p_asset_symbol,
      'quantity', p_quantity, 'price_cents', p_price_cents, 'asset_total_cents', v_asset_total_cents,
      'cash_leg_amount_cents', v_cash_leg_amount_cents, 'fx_rate', p_fx_rate,
      'converted_amount_cents', p_converted_amount_cents
    )
  );

  return v_holding_tx_id;
end;
$$;

comment on function public.create_investment_buy is
  'Yatırım alışı. Varlık para birimi = hesap para birimi ise doğrudan kabul; '
  'farklıysa fx_rate/fx_rate_date/fx_rate_source/converted_amount_cents ZORUNLU. '
  'Maliyet tabanı her zaman varlığın kendi para biriminde tutulur.';

drop function if exists public.create_investment_sell(
  uuid, text, text, numeric, bigint, uuid, timestamptz, text
);

create or replace function public.create_investment_sell(
  p_portfolio_id uuid,
  p_asset_symbol text,
  p_asset_type text,
  p_quantity numeric,
  p_price_cents bigint,
  p_cash_account_id uuid,
  p_occurred_at timestamptz default now(),
  p_note text default null,
  p_fx_rate numeric default null,
  p_fx_rate_date date default null,
  p_fx_rate_source text default null,
  p_converted_amount_cents bigint default null
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
  v_holding_currency text;
  v_account_currency text;
  v_avg_cost_per_unit numeric;
  v_cost_of_sold_cents bigint;
  v_proceeds_asset_cents bigint;
  v_cash_leg_amount_cents bigint;
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

  select currency into v_account_currency from public.accounts where id = p_cash_account_id;
  if v_account_currency is null then
    raise exception 'Hesap bulunamadi (id=%)', p_cash_account_id;
  end if;

  select id, quantity, total_cost_basis_cents, currency
    into v_holding_id, v_holding_quantity, v_holding_cost_basis, v_holding_currency
  from public.holdings
  where portfolio_id = p_portfolio_id
    and asset_symbol = p_asset_symbol
    and asset_type = p_asset_type;

  if v_holding_id is null then
    raise exception 'Bu varliktan elinizde hic yok (symbol=%, asset_type=%)', p_asset_symbol, p_asset_type;
  end if;

  if p_quantity > v_holding_quantity then
    raise exception
      'Fazla satis: elinizde % adet var, % adet satmaya calisiyorsunuz (symbol=%)',
      v_holding_quantity, p_quantity, p_asset_symbol;
  end if;

  v_avg_cost_per_unit := v_holding_cost_basis::numeric / v_holding_quantity;

  if p_quantity = v_holding_quantity then
    v_cost_of_sold_cents := v_holding_cost_basis;
  else
    v_cost_of_sold_cents := round(v_avg_cost_per_unit * p_quantity);
  end if;

  v_proceeds_asset_cents := round(p_quantity * p_price_cents)::bigint;
  v_realized_gain_cents := v_proceeds_asset_cents - v_cost_of_sold_cents;

  -- ── ÇOKLU PARA BİRİMİ KONTROLÜ ──
  if v_holding_currency = v_account_currency then
    if p_fx_rate is not null or p_fx_rate_date is not null
       or p_fx_rate_source is not null or p_converted_amount_cents is not null
    then
      raise exception
        'Ayni para biriminde (% ) islemlerde fx parametreleri gonderilmemelidir', v_holding_currency;
    end if;
    v_cash_leg_amount_cents := v_proceeds_asset_cents;
  else
    if p_fx_rate is null or p_fx_rate_date is null
       or p_fx_rate_source is null or p_converted_amount_cents is null
    then
      raise exception
        'Farkli para birimlerinde islem icin fx_rate, fx_rate_date, fx_rate_source ve converted_amount_cents ZORUNLUDUR (varlik=%, hesap=%)',
        v_holding_currency, v_account_currency;
    end if;

    if p_fx_rate <= 0 then
      raise exception 'fx_rate pozitif olmalidir';
    end if;

    if p_converted_amount_cents <= 0 then
      raise exception 'converted_amount_cents pozitif olmalidir';
    end if;

    if p_fx_rate_source not in ('manual', 'provider') then
      raise exception 'fx_rate_source "manual" veya "provider" olmalidir';
    end if;

    v_cash_leg_amount_cents := p_converted_amount_cents;
  end if;

  v_transaction_id := public.create_simple_transaction(
    p_book_id => v_book_id,
    p_account_id => p_cash_account_id,
    p_type => 'income',
    p_amount_cents => v_cash_leg_amount_cents,
    p_note => p_note,
    p_occurred_at => p_occurred_at
  );

  update public.holdings
  set quantity = quantity - p_quantity,
      total_cost_basis_cents = total_cost_basis_cents - v_cost_of_sold_cents,
      realized_gain_cents = realized_gain_cents + v_realized_gain_cents
  where id = v_holding_id;

  insert into public.holding_transactions
    (holding_id, transaction_id, type, quantity, price_cents, realized_gain_cents, occurred_at,
     fx_rate, fx_rate_date, fx_rate_source, converted_amount_cents)
  values
    (v_holding_id, v_transaction_id, 'sell', p_quantity, p_price_cents, v_realized_gain_cents, p_occurred_at,
     p_fx_rate, p_fx_rate_date, p_fx_rate_source, p_converted_amount_cents)
  returning id into v_holding_tx_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (
    v_book_id, auth.uid(), 'created', 'holding_transaction', v_holding_tx_id, v_transaction_id,
    jsonb_build_object(
      'holding_id', v_holding_id, 'type', 'sell', 'asset_symbol', p_asset_symbol,
      'quantity', p_quantity, 'price_cents', p_price_cents, 'proceeds_asset_cents', v_proceeds_asset_cents,
      'cost_of_sold_cents', v_cost_of_sold_cents, 'realized_gain_cents', v_realized_gain_cents,
      'cash_leg_amount_cents', v_cash_leg_amount_cents, 'fx_rate', p_fx_rate,
      'converted_amount_cents', p_converted_amount_cents
    )
  );

  return v_holding_tx_id;
end;
$$;

comment on function public.create_investment_sell is
  'Yatırım satışı. Varlık para birimi = hesap para birimi ise doğrudan kabul; '
  'farklıysa fx_rate/fx_rate_date/fx_rate_source/converted_amount_cents ZORUNLU. '
  'Gerçekleşmiş kâr/zarar her zaman varlığın kendi para biriminde hesaplanır.';

-- Eski fonksiyonlar DROP edildiği için grant'ler de onlarla birlikte
-- kalktı — yeni (13 parametreli) imzalara grant'leri yeniden veriyoruz.

revoke all on function public.create_investment_buy(
  uuid, text, text, numeric, bigint, uuid, text, timestamptz, text, numeric, date, text, bigint
) from public;
grant execute on function public.create_investment_buy(
  uuid, text, text, numeric, bigint, uuid, text, timestamptz, text, numeric, date, text, bigint
) to authenticated;

revoke all on function public.create_investment_sell(
  uuid, text, text, numeric, bigint, uuid, timestamptz, text, numeric, date, text, bigint
) from public;
grant execute on function public.create_investment_sell(
  uuid, text, text, numeric, bigint, uuid, timestamptz, text, numeric, date, text, bigint
) to authenticated;
