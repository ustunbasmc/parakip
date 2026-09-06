-- 0031_holding_transactions.sql
-- Amaç: Bir holding üzerindeki her alış/satış hareketinin kaydı.
-- transaction_id NOT NULL: her alış/satış, ledger'daki GERÇEK bir nakit
-- hareketine (create_simple_transaction ile oluşturulan) bağlanmak
-- ZORUNDADIR — borç ödemesindeki "harici/manüel" kavramının aksine,
-- yatırım işlemlerinde nakit bacağı olmadan bir alış/satış anlamsızdır.

create table public.holding_transactions (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.holdings (id) on delete restrict,
  transaction_id uuid not null references public.transactions (id) on delete restrict,
  type text not null check (type in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price_cents bigint not null check (price_cents > 0),
  realized_gain_cents bigint, -- yalnızca type='sell' iken dolu, 'buy'da NULL
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.holding_transactions is
  'Bir holding üzerindeki tek bir alış/satış hareketi. price_cents, işlem '
  'anındaki BİRİM fiyattır (kuruş). realized_gain_cents yalnızca satışlarda '
  'doludur ve o SATIŞA ÖZGÜ gerçekleşmiş kâr/zararı taşır (holdings.'
  'realized_gain_cents ise kümülatif toplamdır). '
  'BİLİNEN KISITLAMA: bu tabloda henüz iptal (cancel) mekanizması YOK — '
  'bir alış/satışın geri alınması, holdings''in quantity/maliyet/gerçekleşmiş '
  'kâr durumunu tutarlı şekilde geri sarmayı gerektirir ve bu round''un '
  'kapsamı dışında bırakılmıştır. Yine de fiziksel SİLME mümkün değildir '
  '(grant yok) — bu, projenin "finansal kayıtlar silinmez" ilkesiyle '
  'kısmen tutarlıdır (iptal henüz yok, ama silme de yok).';

create index holding_transactions_holding_id_idx on public.holding_transactions (holding_id, occurred_at);
create index holding_transactions_transaction_id_idx on public.holding_transactions (transaction_id);

alter table public.holding_transactions enable row level security;

create policy holding_transactions_select_member
  on public.holding_transactions for select
  using (
    exists (
      select 1
      from public.holdings h
      join public.portfolios p on p.id = h.portfolio_id
      where h.id = holding_transactions.holding_id
        and public.is_book_member(p.book_id)
    )
  );

-- Bilinçli olarak: INSERT/UPDATE/DELETE için hiçbir politika/grant yok —
-- tüm yazma create_investment_buy/sell() üzerinden yapılır.

grant select on public.holding_transactions to authenticated;
