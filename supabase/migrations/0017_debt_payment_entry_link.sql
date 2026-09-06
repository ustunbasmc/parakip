-- 0017_debt_payment_entry_link.sql
-- Amaç: debt_payments.transaction_id (transactions.id) yerine, tutar/yön
-- eşleşmesini KESİN hale getirmek için debt_payments.transaction_entry_id
-- (transaction_entries.id) kullanmak.
--
-- GEREKÇE: Bir transaction_id, aynı defter içi transferde AYNI book_id
-- altında 2 entry içerebilir (ör. banka->nakit, ikisi de Ev defterinde).
-- Yalnızca transaction_id + book_id ile eşleştirme yapmak bu durumda
-- HANGİ hareketin kastedildiği konusunda belirsizlik yaratır. Tek bir
-- transaction_entries satırına bağlanmak bu belirsizliği yapısal olarak
-- ortadan kaldırır: bir entry = tek book_id + tek account_id + tek
-- amount_cents.

alter table public.debt_payments drop column transaction_id;

alter table public.debt_payments
  add column transaction_entry_id uuid references public.transaction_entries (id) on delete restrict;

-- KARAR: hesap hareketi olmadan yapılan ödemeler "harici/manüel ödeme"
-- olarak AÇIKÇA işaretlenir (yalnızca NULL kontrolüne bırakılmaz).
alter table public.debt_payments
  add column is_external boolean generated always as (transaction_entry_id is null) stored;

create index debt_payments_transaction_entry_id_idx on public.debt_payments (transaction_entry_id);

-- KARAR: Bir transaction_entries satırı, AYNI ANDA en fazla BİR aktif
-- debt_payment tarafından kullanılabilir. Bu TEK KISIT, hem "başka borca
-- ait işlemin kullanılması" hem "aynı işlemin ikinci kez kullanılması"
-- durumlarını veritabanı seviyesinde birlikte engeller. İptal edilmiş bir
-- ödeme bu kısıtın dışındadır (iptal sonrası aynı entry başka bir ödemeyle
-- yeniden ilişkilendirilebilir — ör. yanlış eşleştirmeyi düzeltmek için).
create unique index debt_payments_transaction_entry_unique
  on public.debt_payments (transaction_entry_id)
  where status = 'active' and transaction_entry_id is not null;

comment on column public.debt_payments.transaction_entry_id is
  'İsteğe bağlı. Doluysa, bu ödemenin karşılık geldiği GERÇEK hesap hareketi '
  '(transaction_entries.id). Tutar ve yön (payable->negatif, '
  'receivable->pozitif), create_debt_payment() tarafından zorunlu kılınır.';

comment on column public.debt_payments.is_external is
  'true ise bu ödemenin herhangi bir hesap hareketiyle ilişkisi YOKTUR '
  '(harici/manüel ödeme — ör. nakit elden teslim, uygulama dışı banka '
  'havalesi). transaction_entry_id sütunundan otomatik türetilir.';

-- "Yalnızca iptal edilebilir" trigger'ı, artık yeni sütun adını referans
-- almalı (transaction_id yerine transaction_entry_id).
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
     or new.transaction_entry_id is distinct from old.transaction_entry_id
     or new.paid_at <> old.paid_at
  then
    raise exception 'Iptal disinda debt_payments alanlari guncellenemez';
  end if;

  new.cancelled_at := now();
  return new;
end;
$$;
