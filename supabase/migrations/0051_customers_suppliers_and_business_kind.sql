-- 0051_customers_suppliers_and_business_kind.sql
-- Amaç: (1) Satış/Alış/Masraf ayrımını NOT ÖNEKİNE DEĞİL, güvenilir bir
-- SİSTEM ALANINA dayandırmak, (2) Müşteri/Tedarikçi yönetimi altyapısı.
-- SAF EKLEME — mevcut ledger (transactions/transaction_entries), RLS,
-- audit_log ve borç fonksiyonları (create_debt, create_debt_payment,
-- cancel_debt, cancel_debt_payment) HİÇ DEĞİŞTİRİLMEDİ.
--
-- ÖNEMLİ: transactions.metadata (jsonb) SÜTUNU ZATEN VARDI (bkz. 0006) ve
-- create_simple_transaction() ZATEN p_metadata PARAMETRESİ KABUL EDİYORDU
-- (bkz. 0028) — yani gelir/gider işlemlerinde "business_kind" etiketi
-- için HİÇBİR migration GEREKMEDİ, yalnızca uygulama kodu artık
-- p_metadata: {"business_kind": "sale"} gönderiyor (bkz. business.ts).
-- debts tablosunda ise böyle bir alan YOKTU — bu migration onu ekliyor.

-- ─────────────────────────────────────────────
-- debts: metadata + customer/supplier bağlantısı (nullable, geriye dönük
-- uyumlu — mevcut satırlar etkilenmez, mevcut create_debt() imzası
-- DEĞİŞMEDİ, yeni alanlar yalnızca AŞAĞIDAKİ yeni fonksiyonlar veya
-- doğrudan RLS'e tabi UPDATE ile doldurulur).
-- ─────────────────────────────────────────────
alter table public.debts add column metadata jsonb not null default '{}'::jsonb;
alter table public.debts add column customer_id uuid;
alter table public.debts add column supplier_id uuid;

comment on column public.debts.metadata is
  'Güvenilir sistem sınıflandırması için (ör. {"business_kind":"sale"} veya '
  '{"business_kind":"purchase"}). Kullanıcı notu (debts.note) ile KARIŞTIRILMAZ '
  '— metadata yalnızca uygulama tarafından, note yalnızca kullanıcı tarafından '
  'yazılır.';

-- ─────────────────────────────────────────────
-- customers / suppliers
-- ─────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  note text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  note text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'İşletme alanları için müşteri kaydı. Fiziksel silme YOKTUR — yalnızca '
  'is_archived. Ev alanlarında (type=home) kullanılması ÖNGÖRÜLMEMİŞTİR '
  '(uygulama kodu yalnızca type=business alanlarda gösterir).';
comment on table public.suppliers is
  'İşletme alanları için tedarikçi kaydı. Fiziksel silme YOKTUR — yalnızca '
  'is_archived.';

-- debts.customer_id/supplier_id FK'lerini şimdi ekliyoruz (tablolar artık var).
alter table public.debts
  add constraint debts_customer_id_fkey foreign key (customer_id) references public.customers (id) on delete set null;
alter table public.debts
  add constraint debts_supplier_id_fkey foreign key (supplier_id) references public.suppliers (id) on delete set null;

create index customers_space_id_idx on public.customers (space_id);
create index suppliers_space_id_idx on public.suppliers (space_id);
create index debts_customer_id_idx on public.debts (customer_id) where customer_id is not null;
create index debts_supplier_id_idx on public.debts (supplier_id) where supplier_id is not null;

alter table public.customers enable row level security;
alter table public.suppliers enable row level security;

create policy customers_select_member on public.customers for select using (public.is_space_member(space_id));
create policy customers_insert_editor_plus on public.customers for insert
  with check (public.has_space_role(space_id, array['owner', 'admin', 'editor']));
create policy customers_update_editor_plus on public.customers for update
  using (public.has_space_role(space_id, array['owner', 'admin', 'editor']));

create policy suppliers_select_member on public.suppliers for select using (public.is_space_member(space_id));
create policy suppliers_insert_editor_plus on public.suppliers for insert
  with check (public.has_space_role(space_id, array['owner', 'admin', 'editor']));
create policy suppliers_update_editor_plus on public.suppliers for update
  using (public.has_space_role(space_id, array['owner', 'admin', 'editor']));

grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.suppliers to authenticated;
-- DELETE grant/policy YOK — fiziksel silme tamamen engelli, yalnızca
-- is_archived ile "arşivleme" (UPDATE) yapılabilir.

-- ─────────────────────────────────────────────
-- create_debt_v2 — mevcut create_debt() İLE AYNI DAVRANIŞ + isteğe bağlı
-- metadata/customer_id/supplier_id. Mevcut create_debt() (6 parametreli)
-- HİÇ DEĞİŞTİRİLMEDİ/SİLİNMEDİ — yalnızca yeni, ayrı bir fonksiyon
-- eklendi (mevcut çağrı yerleri bozulmasın diye). Uygulama kodu artık
-- Satış/Alış akışlarında bunu, diğer her yerde eski create_debt()'i
-- kullanır.
-- ─────────────────────────────────────────────
create or replace function public.create_debt_v2(
  p_book_id uuid,
  p_counterparty_name text,
  p_direction text,
  p_principal_cents bigint,
  p_due_date date default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_customer_id uuid default null,
  p_supplier_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt_id uuid;
  v_space_id uuid;
begin
  if p_direction not in ('payable', 'receivable') then
    raise exception 'direction "payable" veya "receivable" olmalidir';
  end if;
  if p_principal_cents is null or p_principal_cents <= 0 then
    raise exception 'principal_cents pozitif olmalidir';
  end if;
  if p_counterparty_name is null or length(trim(p_counterparty_name)) = 0 then
    raise exception 'counterparty_name bos olamaz';
  end if;
  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  select space_id into v_space_id from public.books where id = p_book_id;

  -- customer_id/supplier_id verildiyse, GERÇEKTEN aynı alana ait olduğu
  -- doğrulanır (baska bir isletmenin musterisine yanlislikla/kotu niyetle
  -- borc baglanamasin diye).
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and space_id = v_space_id
  ) then
    raise exception 'Musteri bu alana ait degil (customer_id=%)', p_customer_id;
  end if;
  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id = p_supplier_id and space_id = v_space_id
  ) then
    raise exception 'Tedarikci bu alana ait degil (supplier_id=%)', p_supplier_id;
  end if;

  insert into public.debts
    (book_id, counterparty_name, direction, principal_cents, due_date, note, metadata, customer_id, supplier_id)
  values
    (p_book_id, trim(p_counterparty_name), p_direction, p_principal_cents, p_due_date, p_note, p_metadata, p_customer_id, p_supplier_id)
  returning id into v_debt_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (p_book_id, auth.uid(), 'created', 'debt', v_debt_id, jsonb_build_object('direction', p_direction, 'principal_cents', p_principal_cents, 'metadata', p_metadata));

  return v_debt_id;
end;
$$;

comment on function public.create_debt_v2 is
  'create_debt() ile AYNI davranış + isteğe bağlı metadata/customer_id/'
  'supplier_id. Mevcut create_debt() (6 parametreli) DEĞİŞTİRİLMEDİ, ayrı '
  'bir fonksiyondur — mevcut çağıranlar etkilenmez.';

revoke all on function public.create_debt_v2(uuid, text, text, bigint, date, text, jsonb, uuid, uuid) from public;
grant execute on function public.create_debt_v2(uuid, text, text, bigint, date, text, jsonb, uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- create_customer / create_supplier — has_space_role kontrolü RLS
-- politikasında zaten var (INSERT policy), ama customer_id/supplier_id
-- doğrulaması create_debt_v2 içinde gerektiği için burada AYRICA bir RPC
-- YAZMAYA gerek YOK — istemci doğrudan RLS'e tabi INSERT yapar (accounts
-- ile AYNI desen, bkz. formData.ts/AccountForm).
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- debt_balances view'ı YENİDEN TANIMLANIYOR (0040'tan beri var) — yeni
-- customer_id/supplier_id/metadata sütunlarını da içermesi için. View
-- sütun listesi AÇIK olduğundan alttaki tablo değişikliklerini otomatik
-- almaz (account_balances/note ile AYNI durum, bkz. 0043). Hiçbir mevcut
-- sütun/davranış KALDIRILMADI — yalnızca sona ekleme yapıldı.
-- ─────────────────────────────────────────────
create or replace view public.debt_balances
  with (security_invoker = true)
as
select
  d.id as debt_id,
  d.book_id,
  d.counterparty_name,
  d.direction,
  d.principal_cents,
  d.due_date,
  d.status,
  d.note,
  coalesce((
    select sum(dp.amount_cents)
    from public.debt_payments dp
    where dp.debt_id = d.id and dp.status = 'active'
  ), 0) as paid_cents,
  d.principal_cents - coalesce((
    select sum(dp.amount_cents)
    from public.debt_payments dp
    where dp.debt_id = d.id and dp.status = 'active'
  ), 0) as remaining_cents,
  d.metadata,
  d.customer_id,
  d.supplier_id
from public.debts d;

comment on view public.debt_balances is
  'Her borç/alacağın ödenen ve kalan tutarı (iptal edilmiş ödemeler hariç), '
  'artı metadata/customer_id/supplier_id (0051). security_invoker=true '
  'sayesinde RLS gerçek çağıran kullanıcı bağlamında uygulanır.';

grant select on public.debt_balances to authenticated;
