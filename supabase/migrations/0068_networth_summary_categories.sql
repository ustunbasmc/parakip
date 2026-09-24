-- 0068_networth_summary_categories.sql
-- Amaç:
--   1) Net değer: compute_net_worth() — ekrandaki anlık değer ve günlük
--      geçmiş (net_worth_snapshots) AYNI hesaptan gelir.
--      Net değer = hesaplar + yatırımlar + bekleyen alacaklar − bekleyen borçlar.
--      Döviz, önbellekteki güncel kurla (market_prices_cache, TCMB) TL'ye
--      çevrilir; kuru olmayan tutarlar toplama katılmaz, ayrıca listelenir.
--   2) Aylık özet bildirimi: her ayın 1'inde önceki ayın özeti.
--   3) Daha zengin hazır (global) kategoriler.
-- Finansal tablolar ve RPC'leri DEĞİŞTİRİLMEZ; yalnızca okunur.

-- ─────────────────────────────────────────────
-- 1) Net değer
-- ─────────────────────────────────────────────
create or replace function public.fx_rate_to_try(p_currency text)
returns numeric
language sql
security definer
stable
set search_path = public
as $$
  select case when p_currency = 'TRY' then 1::numeric else (
    select price from public.market_prices_cache
     where asset_type = 'fx' and symbol = p_currency and currency = 'TRY'
     order by fetched_at desc limit 1
  ) end;
$$;
revoke all on function public.fx_rate_to_try(text) from public, anon, authenticated;

create or replace function public.compute_net_worth(p_book_id uuid)
returns table (
  accounts_cents bigint,
  investments_cents bigint,
  receivables_cents bigint,
  payables_cents bigint,
  net_cents bigint,
  unconverted jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_unconverted jsonb := '[]'::jsonb;
begin
  -- Oturumlu çağrıda yalnızca alan üyesi; zamanlanmış görevde (auth.uid() yok) serbest.
  if auth.uid() is not null and not public.is_book_member(p_book_id) then
    raise exception 'Bu alanın üyesi değilsin.' using errcode = '42501';
  end if;

  with acc as (
    select ab.currency, sum(ab.balance_cents)::bigint as cents, public.fx_rate_to_try(ab.currency) as rate
      from public.account_balances ab
     where ab.book_id = p_book_id and not ab.is_archived
     group by ab.currency
  ),
  hold as (
    select h.currency,
           sum(coalesce(round(mp.price * 100 * h.quantity), h.total_cost_basis_cents))::bigint as cents,
           public.fx_rate_to_try(h.currency) as rate
      from public.holdings h
      join public.portfolios p on p.id = h.portfolio_id
      left join lateral (
        select price from public.market_prices_cache c
         where c.symbol = h.asset_symbol and c.asset_type = h.asset_type and c.currency = h.currency
         order by c.fetched_at desc limit 1
      ) mp on true
     where p.book_id = p_book_id and h.quantity > 0
     group by h.currency
  ),
  debts as (
    select coalesce(sum(remaining_cents) filter (where direction = 'receivable'), 0)::bigint as rec,
           coalesce(sum(remaining_cents) filter (where direction = 'payable'), 0)::bigint as pay
      from public.debt_balances
     where book_id = p_book_id and status in ('open', 'partial')
  )
  select
    coalesce((select sum(round(cents * rate)) from acc where rate is not null), 0)::bigint,
    coalesce((select sum(round(cents * rate)) from hold where rate is not null), 0)::bigint,
    (select rec from debts),
    (select pay from debts),
    coalesce(
      (select jsonb_agg(jsonb_build_object('kind', k, 'currency', currency, 'cents', cents))
         from (select 'account' as k, currency, cents from acc where rate is null
               union all select 'investment', currency, cents from hold where rate is null) x),
      '[]'::jsonb)
  into accounts_cents, investments_cents, receivables_cents, payables_cents, v_unconverted;

  net_cents := accounts_cents + investments_cents + receivables_cents - payables_cents;
  unconverted := v_unconverted;
  return next;
end;
$$;
revoke all on function public.compute_net_worth(uuid) from public, anon;
grant execute on function public.compute_net_worth(uuid) to authenticated;

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  snapshot_date date not null,
  accounts_cents bigint not null,
  investments_cents bigint not null,
  receivables_cents bigint not null,
  payables_cents bigint not null,
  net_cents bigint not null,
  created_at timestamptz not null default now(),
  unique (book_id, snapshot_date)
);
comment on table public.net_worth_snapshots is
  'Günlük net değer (compute_net_worth ile aynı hesap). Yalnızca zamanlanmış görev yazar.';

alter table public.net_worth_snapshots enable row level security;
drop policy if exists net_worth_snapshots_select_member on public.net_worth_snapshots;
create policy net_worth_snapshots_select_member on public.net_worth_snapshots
  for select using (public.is_book_member(book_id));
revoke all on public.net_worth_snapshots from anon, authenticated;
grant select on public.net_worth_snapshots to authenticated;

create or replace function public.record_net_worth_snapshots()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book uuid;
  v_nw record;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_count integer := 0;
begin
  for v_book in
    select b.id from public.books b join public.spaces s on s.id = b.space_id where not s.is_archived
  loop
    begin
      select * into v_nw from public.compute_net_worth(v_book);
      -- Hiçbir varlık/borç yoksa (boş alan) satır yazılmaz.
      if v_nw.accounts_cents = 0 and v_nw.investments_cents = 0 and v_nw.receivables_cents = 0 and v_nw.payables_cents = 0 then
        continue;
      end if;
      insert into public.net_worth_snapshots (book_id, snapshot_date, accounts_cents, investments_cents, receivables_cents, payables_cents, net_cents)
      values (v_book, v_today, v_nw.accounts_cents, v_nw.investments_cents, v_nw.receivables_cents, v_nw.payables_cents, v_nw.net_cents)
      on conflict (book_id, snapshot_date) do update
        set accounts_cents = excluded.accounts_cents, investments_cents = excluded.investments_cents,
            receivables_cents = excluded.receivables_cents, payables_cents = excluded.payables_cents,
            net_cents = excluded.net_cents, created_at = now();
      v_count := v_count + 1;
    exception when others then
      null; -- tek bir alanın hatası diğerlerini etkilemez
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.record_net_worth_snapshots() from public, anon, authenticated;
grant execute on function public.record_net_worth_snapshots() to service_role;

-- ─────────────────────────────────────────────
-- 2) Aylık özet bildirimi
-- ─────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('debt_due', 'budget_80', 'budget_exceeded', 'transfer_created', 'space_invite', 'support_reply',
                  'subscription_expiring', 'monthly_summary'));

-- 12.340,50 ₺ biçimi (sunucu yereline bağlı kalmadan).
create or replace function public.format_try_cents(p_cents bigint)
returns text
language sql
immutable
as $$
  select translate(to_char(abs(p_cents) / 100.0, 'FM999,999,999,990.00'), ',.', '.,') || ' ₺';
$$;

-- Her ayın 1'inde (İstanbul) önceki ayın gelir/gider özeti; alan sahibine
-- ve yöneticilerine. Aynı ay için ikinci kez üretilmez. Yalnızca TL işlemler.
create or replace function public.create_monthly_summary_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_local timestamp := now() at time zone 'Europe/Istanbul';
  v_month_start timestamptz := date_trunc('month', v_now_local) at time zone 'Europe/Istanbul';
  v_prev_start timestamptz := (date_trunc('month', v_now_local) - interval '1 month') at time zone 'Europe/Istanbul';
  v_prev2_start timestamptz := (date_trunc('month', v_now_local) - interval '2 months') at time zone 'Europe/Istanbul';
  v_months text[] := array['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  v_label text := v_months[extract(month from (date_trunc('month', v_now_local) - interval '1 month'))::int];
  v_book record;
  v_income bigint;
  v_expense bigint;
  v_prev_expense bigint;
  v_top text;
  v_title text;
  v_body text;
  v_user uuid;
  v_count integer := 0;
begin
  if extract(day from v_now_local) <> 1 then
    return 0;
  end if;

  for v_book in
    select b.id as book_id, s.id as space_id from public.books b join public.spaces s on s.id = b.space_id where not s.is_archived
  loop
    select coalesce(sum(te.amount_cents) filter (where t.type = 'income'), 0),
           coalesce(sum(abs(te.amount_cents)) filter (where t.type = 'expense'), 0)
      into v_income, v_expense
      from public.transaction_entries te join public.transactions t on t.id = te.transaction_id
     where te.book_id = v_book.book_id and t.status = 'active' and te.currency = 'TRY'
       and t.type in ('income', 'expense') and t.occurred_at >= v_prev_start and t.occurred_at < v_month_start;
    if v_income = 0 and v_expense = 0 then
      continue;
    end if;

    select coalesce(sum(abs(te.amount_cents)), 0) into v_prev_expense
      from public.transaction_entries te join public.transactions t on t.id = te.transaction_id
     where te.book_id = v_book.book_id and t.status = 'active' and te.currency = 'TRY'
       and t.type = 'expense' and t.occurred_at >= v_prev2_start and t.occurred_at < v_prev_start;

    select coalesce(c.name, 'Kategorisiz') into v_top
      from public.transaction_entries te join public.transactions t on t.id = te.transaction_id
      left join public.categories c on c.id = te.category_id
     where te.book_id = v_book.book_id and t.status = 'active' and te.currency = 'TRY'
       and t.type = 'expense' and t.occurred_at >= v_prev_start and t.occurred_at < v_month_start
     group by c.name order by sum(abs(te.amount_cents)) desc limit 1;

    v_title := v_label || ' özetin: ' || public.format_try_cents(v_expense) || ' gider';
    v_body := 'Gelir ' || public.format_try_cents(v_income)
      || case when v_income - v_expense >= 0 then ' · ' || public.format_try_cents(v_income - v_expense) || ' artıda'
              else ' · ' || public.format_try_cents(v_expense - v_income) || ' ekside' end
      || case when v_prev_expense > 0 then
           ' · geçen aya göre %' || abs(round((v_expense - v_prev_expense) * 100.0 / v_prev_expense))::text
           || case when v_expense <= v_prev_expense then ' daha az harcama' else ' daha fazla harcama' end
         else '' end
      || case when v_top is not null and v_expense > 0 then ' · En çok: ' || v_top else '' end;

    for v_user in
      select user_id from public.space_members where space_id = v_book.space_id and role in ('owner', 'admin')
    loop
      if exists (
        select 1 from public.notifications n
         where n.user_id = v_user and n.type = 'monthly_summary' and n.entity_id = v_book.book_id and n.created_at >= v_month_start
      ) then
        continue;
      end if;
      perform public.create_notification(v_user, 'monthly_summary', v_title, v_body, 'monthly_summary', v_book.book_id, v_book.space_id);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.create_monthly_summary_notifications() from public, anon, authenticated;
grant execute on function public.create_monthly_summary_notifications() to service_role;

-- Günlük görev: 0067 + net değer kaydı + aylık özet.
create or replace function public.run_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  perform public.generate_due_recurring_transactions();
  perform public.generate_due_recurring_debts();
  perform public.create_debt_due_notifications();

  for v_book_id in select id from public.books loop
    perform public.create_budget_alert_notifications(v_book_id);
  end loop;

  perform public.create_subscription_expiry_notifications();
  perform public.create_monthly_summary_notifications();
  perform public.record_net_worth_snapshots();

  delete from public.app_error_events where last_seen < now() - interval '30 days';
end;
$$;
revoke all on function public.run_scheduled_notifications() from public;
grant execute on function public.run_scheduled_notifications() to service_role;

-- ─────────────────────────────────────────────
-- 3) Hazır kategoriler (global; aynı adda aktif olan varsa eklenmez)
-- ─────────────────────────────────────────────
insert into public.categories (book_id, name, kind, is_custom)
select null, v.name, v.kind, false
from (values
  ('Yeme-İçme', 'expense'),
  ('Abonelikler', 'expense'),
  ('Giyim', 'expense'),
  ('Eğitim', 'expense'),
  ('Ev ve Bakım', 'expense'),
  ('Kişisel Bakım', 'expense'),
  ('Çocuk', 'expense'),
  ('Evcil Hayvan', 'expense'),
  ('Tatil ve Seyahat', 'expense'),
  ('Spor ve Hobi', 'expense'),
  ('Hediye ve Bağış', 'expense'),
  ('Sigorta', 'expense'),
  ('Vergi ve Harç', 'expense'),
  ('Kira Geliri', 'income'),
  ('Yatırım Getirisi', 'income'),
  ('Satış Geliri', 'income'),
  ('Hediye ve Harçlık', 'income'),
  ('İade', 'income')
) as v(name, kind)
where not exists (
  select 1 from public.categories c
   where c.book_id is null and c.kind = v.kind and lower(trim(c.name)) = lower(trim(v.name)) and c.is_active
);
