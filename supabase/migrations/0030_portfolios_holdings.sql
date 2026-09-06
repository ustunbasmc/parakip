-- 0030_portfolios_holdings.sql
-- Amaç: Yatırım portföyü ve varlık (holding) yapısı.
--
-- ORTALAMA MALİYET TASARIM KARARI: holdings.avg_cost_cents (birim başına
-- ortalama maliyet) YERİNE total_cost_basis_cents (TOPLAM maliyet tabanı,
-- integer kuruş) SAKLANIR. Gerekçe: quantity kesirli olabilir (kripto,
-- gram altın); birim başına ortalama maliyeti saklayıp her işlemde
-- yeniden türetmek, kesirli bölme sonucu ondalık kuruş biriktirir ve
-- zamanla sapma yaratır. Toplam maliyet tabanı HER ZAMAN tam sayı kuruş
-- olarak kalır; birim başına ortalama maliyet (varsa) sorgu anında
-- total_cost_basis_cents / quantity olarak TÜRETİLİR, hiç saklanmaz.

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.portfolios is
  'Bir deftere ait yatırım portföyü. Bir book''un birden fazla portföyü olabilir.';

alter table public.portfolios enable row level security;

create policy portfolios_select_member
  on public.portfolios for select
  using (public.is_book_member(book_id));

create policy portfolios_insert_editor_plus
  on public.portfolios for insert
  with check (public.has_book_role(book_id, array['owner', 'admin', 'editor']));

-- Bilinçli olarak: UPDATE/DELETE politikası yok (portföy adı değiştirme/
-- silme ayrı bir modülün kapsamı; şimdilik yalnızca oluşturma+görüntüleme).

grant select, insert on public.portfolios to authenticated;

-- ─────────────────────────────────────────────

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete restrict,
  asset_symbol text not null,
  asset_type text not null check (asset_type in ('bist', 'us_stock', 'gold', 'fx', 'crypto')),
  currency text not null default 'TRY',
  quantity numeric not null default 0 check (quantity >= 0),
  total_cost_basis_cents bigint not null default 0 check (total_cost_basis_cents >= 0),
  realized_gain_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, asset_symbol, asset_type)
);

comment on table public.holdings is
  'Bir portföydeki tek bir varlık pozisyonu. quantity>=0 ve '
  'total_cost_basis_cents>=0 CHECK kısıtları, "negatif miktar/maliyet '
  'olamaz" kuralının veritabanı seviyesindeki güvenlik ağıdır — asıl '
  'kontrol create_investment_sell() fonksiyonunda yapılır, bu kısıtlar '
  'ikinci savunma hattıdır. realized_gain_cents, bu holding üzerindeki '
  'TÜM satışlardan gelen kümülatif gerçekleşmiş kâr/zarardır (ayrı '
  'tutulur, total_cost_basis_cents''i hiç etkilemez).';

create index holdings_portfolio_id_idx on public.holdings (portfolio_id);

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

alter table public.holdings enable row level security;

create policy holdings_select_member
  on public.holdings for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
        and public.is_book_member(p.book_id)
    )
  );

-- Bilinçli olarak: INSERT/UPDATE/DELETE politikası/grant''i YOK. quantity
-- ve total_cost_basis_cents''in tutarlılığı (weighted average, fazla satış
-- engeli) yalnızca create_investment_buy/sell() fonksiyonları üzerinden
-- korunabilir — doğrudan yazma izni bu invaryantları bypass edebilirdi.

grant select on public.holdings to authenticated;
