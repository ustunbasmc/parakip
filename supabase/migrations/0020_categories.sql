-- 0020_categories.sql
-- Amaç: Gelir/gider kategorileri. Bütçe modülünün ön koşulu.
--
-- book_id NULL = global şablon kategori (tüm defterlerde kullanılabilir).
-- book_id dolu = yalnızca o deftere özel (kullanıcı tanımlı) kategori.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books (id) on delete restrict,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  parent_id uuid references public.categories (id) on delete restrict,
  is_custom boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.categories is
  'Gelir/gider kategorileri. book_id NULL ise global şablon (tüm defterlerde '
  'kullanılabilir); doluysa yalnızca o deftere özeldir.';

create index categories_book_id_idx on public.categories (book_id);

alter table public.categories enable row level security;

create policy categories_select_member_or_global
  on public.categories for select
  using (book_id is null or public.is_book_member(book_id));

create policy categories_insert_editor_plus
  on public.categories for insert
  with check (
    book_id is not null
    and public.has_book_role(book_id, array['owner', 'admin', 'editor'])
  );

-- Bilinçli olarak: UPDATE/DELETE politikası yok (kategori düzenleme/silme
-- ayrı bir modülün kapsamı; şimdilik yalnızca oluşturma ve görüntüleme var).

grant select, insert on public.categories to authenticated;

-- Global şablon kategoriler (seed).
insert into public.categories (book_id, name, kind, is_custom) values
  (null, 'Market', 'expense', false),
  (null, 'Kira', 'expense', false),
  (null, 'Faturalar', 'expense', false),
  (null, 'Ulaşım', 'expense', false),
  (null, 'Sağlık', 'expense', false),
  (null, 'Eğlence', 'expense', false),
  (null, 'Diğer Gider', 'expense', false),
  (null, 'Maaş', 'income', false),
  (null, 'Ek Gelir', 'income', false),
  (null, 'Diğer Gelir', 'income', false);

-- transaction_entries.category_id artık gerçek bir FK'ye bağlanabilir
-- (önceki migration'larda "categories tablosu henüz yok" notuyla FK'siz
-- bırakılmıştı — bu borç kapatılıyor).
alter table public.transaction_entries
  add constraint transaction_entries_category_id_fkey
  foreign key (category_id) references public.categories (id) on delete restrict;
