-- 0004_books_accounts.sql
-- Amaç: Her space'in finansal defteri (book) ve defter altındaki hesaplar.
--
-- V1 VARSAYIMI: Bir space'in yalnızca 1 defteri olur (space:book = 1:1).
-- Bu, ayrı bir books tablosu olarak tasarlandı (space'in kendisine değil)
-- çünkü ileride (v1 sonrası) bir İşletme space'inin birden çok şube
-- defterine sahip olması ihtimaline karşı şema genişleyebilir kalsın
-- isteniyor. V1 kısıtı aşağıdaki unique index ile zorlanıyor; bu kısıt
-- ileride kaldırılabilir bir "geçici" karardır, kalıcı bir mimari sınır
-- değildir.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  currency text not null default 'TRY',
  theme_id uuid, -- FK, themes tablosu ileride eklenince bağlanacak (henüz yok)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.books is
  'Bir space''e ait finansal defter. V1''de space:book = 1:1 (bkz. books_one_per_space_v1); bu kısıt ileride kaldırılabilir.';

-- V1 kısıtı: her space'in en fazla 1 defteri olabilir.
create unique index books_one_per_space_v1
  on public.books (space_id);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- Defter altındaki hesaplar (nakit, banka, kredi kartı, POS, yatırım nakit vb.).
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  name text not null,
  type text not null check (
    type in ('cash', 'bank', 'credit_card', 'pos', 'investment_cash', 'other')
  ),
  currency text not null default 'TRY',
  opening_balance_cents bigint not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.accounts is
  'Bir defterin hesapları. opening_balance_cents integer kuruş cinsindendir (kayan nokta KULLANILMAZ).';

create index accounts_book_id_idx on public.accounts (book_id) where not is_archived;

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
