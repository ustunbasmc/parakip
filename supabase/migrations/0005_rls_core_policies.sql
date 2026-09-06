-- 0005_rls_core_policies.sql
-- Amaç: profiles, spaces, space_members, books, accounts için RLS'i
-- etkinleştirmek ve gerekli politikaları tanımlamak.
--
-- ÖNEMLİ: Bu dosya, "sunucu tarafı yetki kontrolü" ilkesinin veritabanı
-- seviyesindeki karşılığıdır. Uygulama kodu bu kontrolleri AYRICA da
-- yapmalıdır (defense in depth) — RLS tek başına yeterli görülmemelidir,
-- özellikle service-role anahtarının RLS'i bypass ettiği unutulmamalıdır.

-- ─────────────────────────────────────────────
-- Yardımcı fonksiyonlar
-- ─────────────────────────────────────────────

-- Kullanıcı, verilen space'e üye mi?
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
  );
$$;

-- Kullanıcı, verilen space'te belirtilen rollerden birine sahip mi?
create or replace function public.has_space_role(p_space_id uuid, p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
      and sm.role = any (p_roles)
  );
$$;

-- Kullanıcı, verilen book'un bağlı olduğu space'e üye mi?
-- (accounts gibi book_id taşıyan tablolarda kullanılır.)
create or replace function public.is_book_member(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    join public.space_members sm on sm.space_id = b.space_id
    where b.id = p_book_id
      and sm.user_id = auth.uid()
  );
$$;

-- Kullanıcı, verilen book'un bağlı olduğu space'te belirtilen rollerden birine sahip mi?
create or replace function public.has_book_role(p_book_id uuid, p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    join public.space_members sm on sm.space_id = b.space_id
    where b.id = p_book_id
      and sm.user_id = auth.uid()
      and sm.role = any (p_roles)
  );
$$;

comment on function public.is_space_member is
  'RLS yardımcı fonksiyonu: auth.uid() verilen space_id''ye üye mi.';
comment on function public.has_space_role is
  'RLS yardımcı fonksiyonu: auth.uid() verilen space_id''de belirtilen rollerden birine sahip mi.';
comment on function public.is_book_member is
  'RLS yardımcı fonksiyonu: auth.uid() verilen book_id''nin space''ine üye mi.';
comment on function public.has_book_role is
  'RLS yardımcı fonksiyonu: auth.uid() verilen book_id''nin space''inde belirtilen rollerden birine sahip mi.';

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (user_id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  using (user_id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert
  with check (user_id = auth.uid());

-- Not: profiles kaydı normalde handle_new_user trigger'ıyla (security definer,
-- RLS'i bypass eder) otomatik oluşturulur; profiles_insert_own politikası
-- yalnızca ileride istemci tarafından doğrudan bir insert denenirse devreye girer.

-- ─────────────────────────────────────────────
-- spaces
-- ─────────────────────────────────────────────

alter table public.spaces enable row level security;

create policy spaces_select_member
  on public.spaces for select
  using (public.is_space_member(id));

create policy spaces_insert_as_owner
  on public.spaces for insert
  with check (owner_user_id = auth.uid());
  -- Not: type='home' için "kullanıcı başına 1 tane" kuralı burada değil,
  -- spaces_one_home_per_user unique index'i tarafından zorlanır (0003).

create policy spaces_update_owner_admin
  on public.spaces for update
  using (public.has_space_role(id, array['owner', 'admin']));

create policy spaces_delete_owner_only
  on public.spaces for delete
  using (owner_user_id = auth.uid());

-- ─────────────────────────────────────────────
-- space_members
-- ─────────────────────────────────────────────

alter table public.space_members enable row level security;

create policy space_members_select_member
  on public.space_members for select
  using (public.is_space_member(space_id));

create policy space_members_insert_owner_admin
  on public.space_members for insert
  with check (public.has_space_role(space_id, array['owner', 'admin']));

create policy space_members_update_owner_admin
  on public.space_members for update
  using (public.has_space_role(space_id, array['owner', 'admin']));

create policy space_members_delete_owner_admin
  on public.space_members for delete
  using (public.has_space_role(space_id, array['owner', 'admin']));

-- ─────────────────────────────────────────────
-- books
-- ─────────────────────────────────────────────

alter table public.books enable row level security;

create policy books_select_member
  on public.books for select
  using (public.is_space_member(space_id));

create policy books_insert_owner_admin
  on public.books for insert
  with check (public.has_space_role(space_id, array['owner', 'admin']));

create policy books_update_owner_admin
  on public.books for update
  using (public.has_space_role(space_id, array['owner', 'admin']));

-- Not: books için DELETE politikası bilinçli olarak tanımlanmadı.
-- Finansal kayıtlar "silinmez, iptal/arşivlenir" ilkesi (madde 11/14.5)
-- defterler için de geçerli sayılıyor; bir defterin kapatılması ileride
-- is_archived benzeri bir alanla, ayrı bir kararla ele alınacak.

-- ─────────────────────────────────────────────
-- accounts
-- ─────────────────────────────────────────────

alter table public.accounts enable row level security;

create policy accounts_select_member
  on public.accounts for select
  using (public.is_book_member(book_id));

create policy accounts_insert_editor_plus
  on public.accounts for insert
  with check (public.has_book_role(book_id, array['owner', 'admin', 'editor']));

create policy accounts_update_editor_plus
  on public.accounts for update
  using (public.has_book_role(book_id, array['owner', 'admin', 'editor']));

create policy accounts_delete_owner_admin
  on public.accounts for delete
  using (public.has_book_role(book_id, array['owner', 'admin']));
