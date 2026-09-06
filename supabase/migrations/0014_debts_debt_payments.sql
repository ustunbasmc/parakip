-- 0014_debts_debt_payments.sql
-- Amaç: Borç/alacak ve kısmi ödeme sistemi.
--
-- direction: 'payable' = bizim ödeyeceğimiz borç, 'receivable' = bize
-- ödenecek alacak.
-- status: open (hiç ödeme yok) -> partial (kısmi ödendi) -> paid (tam
-- ödendi). Bu üç durum OTOMATİK hesaplanır (bkz. after_debt_payment_change
-- trigger'ı). 'cancelled' ise yalnızca cancel_debt() fonksiyonuyla, manuel
-- olarak set edilir ve otomatik hesaplamanın dışındadır.
--
-- KARAR: debts/debt_payments için RLS INSERT/UPDATE/DELETE politikası ve
-- authenticated grant'i KASITLI OLARAK TANIMLANMADI. Borcun birden fazla
-- değişebilir alanı ve otomatik hesaplanan durumu olduğu için, bu
-- karmaşıklığı RLS+trigger ile güvenli ifade etmek yerine (transactions'ta
-- olduğu gibi), TÜM yazma işlemleri 0016'daki SECURITY DEFINER
-- fonksiyonlar (create_debt, update_debt, cancel_debt,
-- create_debt_payment, cancel_debt_payment) üzerinden yapılır — bu,
-- audit_log'da zaten kullandığımız "yalnızca fonksiyon yazabilir"
-- desenin borçlara uygulanmış halidir.

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  counterparty_name text not null,
  direction text not null check (direction in ('payable', 'receivable')),
  principal_cents bigint not null check (principal_cents > 0),
  due_date date,
  note text,
  status text not null default 'open' check (status in ('open', 'partial', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.debts is
  'Borç/alacak kaydı. status (open/partial/paid) debt_payments üzerinden '
  'otomatik hesaplanır; cancelled yalnızca manuel, cancel_debt() ile set edilir. '
  'book_id/direction/principal_cents oluşturulduktan sonra DEĞİŞTİRİLEMEZ '
  '(bkz. enforce_debt_immutable_fields).';

create index debts_book_id_idx on public.debts (book_id, status);
create index debts_due_date_idx on public.debts (due_date) where status in ('open', 'partial');

-- book_id/direction/principal_cents kalıcı olarak sabittir; yalnızca
-- counterparty_name, due_date, note, status, updated_at değişebilir.
create or replace function public.enforce_debt_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.book_id <> old.book_id
     or new.direction <> old.direction
     or new.principal_cents <> old.principal_cents
  then
    raise exception 'debts.book_id, direction ve principal_cents degistirilemez';
  end if;
  return new;
end;
$$;

create trigger debts_enforce_immutable_fields
  before update on public.debts
  for each row execute function public.enforce_debt_immutable_fields();

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz not null default now(),
  transaction_id uuid references public.transactions (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table public.debt_payments is
  'Bir borcun kısmi/tam ödeme hareketi. transaction_id İSTEĞE BAĞLIDIR: '
  'dolu ise gerçek bir hesap hareketiyle (create_simple_transaction/'
  'create_transfer ile önceden oluşturulmuş) ilişkilendirilmiştir. '
  'Fiziksel olarak SİLİNMEZ; yalnızca status=cancelled''e güncellenebilir.';

create index debt_payments_debt_id_idx on public.debt_payments (debt_id) where status = 'active';
create index debt_payments_transaction_id_idx on public.debt_payments (transaction_id);

-- "Yalnızca iptal edilebilir" kuralı — transactions'taki
-- enforce_transaction_cancel_only ile birebir aynı desen.
create or replace function public.enforce_debt_payment_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'active' then
    raise exception 'Yalnizca active durumundaki odemeler iptal edilebilir (mevcut: %)', old.status;
  end if;

  if new.status <> 'cancelled' then
    raise exception 'debt_payments.status yalnizca active -> cancelled yonunde guncellenebilir';
  end if;

  if new.debt_id <> old.debt_id
     or new.amount_cents <> old.amount_cents
     or new.transaction_id is distinct from old.transaction_id
     or new.paid_at <> old.paid_at
  then
    raise exception 'Iptal disinda debt_payments alanlari guncellenemez';
  end if;

  new.cancelled_at := now();
  return new;
end;
$$;

create trigger debt_payments_enforce_cancel_only
  before update on public.debt_payments
  for each row execute function public.enforce_debt_payment_immutable_fields();

-- ─────────────────────────────────────────────
-- KURAL: Fazla ödeme reddi + debts.status otomatik hesaplama.
-- Tek trigger'da birleştirildi (aynı SUM sorgusunu iki kez çalıştırmamak
-- ve trigger sıralama belirsizliğinden kaçınmak için).
-- ─────────────────────────────────────────────

create or replace function public.after_debt_payment_change()
returns trigger
language plpgsql
security definer -- debts tablosunu güncelleyebilmek için (RLS'te debts'e
                  -- UPDATE grant'i yok, yalnızca bu trigger fonksiyonu
                  -- tablo sahibi yetkisiyle günceller).
set search_path = public
as $$
declare
  v_debt_id uuid;
  v_principal bigint;
  v_debt_status text;
  v_paid bigint;
begin
  v_debt_id := coalesce(new.debt_id, old.debt_id);

  select principal_cents, status into v_principal, v_debt_status
  from public.debts
  where id = v_debt_id;

  select coalesce(sum(amount_cents), 0) into v_paid
  from public.debt_payments
  where debt_id = v_debt_id
    and status = 'active';

  if v_paid > v_principal then
    raise exception
      'Borc/alacak fazla odenemez (debt_id=%, ana_tutar=%, toplam_odeme=%)',
      v_debt_id, v_principal, v_paid;
  end if;

  -- cancelled durumundaki bir borcun statusu, ödeme hareketlerinden
  -- etkilenmez (manuel iptal, otomatik hesaplamanın üzerine yazılmaz).
  if v_debt_status <> 'cancelled' then
    update public.debts
    set status = case
          when v_paid <= 0 then 'open'
          when v_paid < v_principal then 'partial'
          else 'paid'
        end,
        updated_at = now()
    where id = v_debt_id;
  end if;

  return null;
end;
$$;

create trigger debt_payments_after_change
  after insert or update on public.debt_payments
  for each row execute function public.after_debt_payment_change();

comment on function public.after_debt_payment_change is
  'Her debt_payments INSERT/UPDATE''inden sonra: (1) toplam aktif ödemenin '
  'ana tutarı aşmadığını doğrular (aşarsa REDDEDER, tüm işlem geri alınır), '
  '(2) debts.status''u open/partial/paid olarak otomatik yeniden hesaplar. '
  'cancelled durumundaki borçlara dokunmaz.';
