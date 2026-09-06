-- 0006_transactions_entries.sql
-- Amaç: Finansal çekirdek. transactions = olayın kendisi (book_id İÇERMEZ),
-- transaction_entries = o olayın her bir hesap/defter üzerindeki etkisi.
--
-- KAPSAM (bu migration): income, expense, transfer (aynı defter içi,
-- Ev-İşletme cross-book, kredi kartı ödemesi transfer'in bir alt durumu).
-- investment_buy/investment_sell bu migration'da YOK — holdings/portfolios
-- tabloları henüz yazılmadı, yatırım modülü ayrı bir migration'da eklenecek
-- (type CHECK kısıtı o zaman genişletilecek).
--
-- KARAR D6: note alanı burada değil, transaction_entries'te (cross-book
-- sızıntısını önlemek için).
-- KARAR D8: created_by/cancelled_by burada YOK; aktör bilgisi ileride
-- audit_log migration'ı eklenince o tabloda, defter bazlı tutulacak.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense', 'transfer')),
  occurred_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  recurring_rule_id uuid, -- FK, recurring_rules tablosu henüz yok
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table public.transactions is
  'Finansal olayın başlığı. Kasıtlı olarak book_id, created_by, note İÇERMEZ '
  '(D6/D7/D8 kararları) — bunlar transaction_entries ve audit_log seviyesinde tutulur. '
  'Fiziksel olarak SİLİNMEZ; yalnızca status=cancelled''e güncellenebilir (bkz. enforce_transaction_cancel_only).';

create index transactions_status_idx on public.transactions (status);
create index transactions_occurred_at_idx on public.transactions (occurred_at);

-- Her entry, bir transaction'ın belirli bir defter/hesap üzerindeki etkisidir.
create table public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete restrict,
  account_id uuid not null references public.accounts (id) on delete restrict,
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'TRY',
  category_id uuid, -- FK, categories tablosu henüz yok
  note text,
  created_at timestamptz not null default now()
);

comment on table public.transaction_entries is
  'Bir transaction''ın tek bir book/account üzerindeki parasal etkisi. '
  'amount_cents işaretlidir: pozitif = hesabın net değerini artırır, negatif = azaltır '
  '(borç hesapları -kredi kartı gibi- bakiyeyi negatif taşır, bu yüzden tek işaret kuralı '
  'tüm hesap tiplerinde tutarlıdır). '
  'book_id ON DELETE RESTRICT: bir defterin işlem geçmişi varsa silinemez. '
  'account_id ON DELETE RESTRICT: işlem geçmişi olan bir hesap silinemez, yalnızca '
  'accounts.is_archived ile arşivlenebilir — bu FK kısıtı, accounts tablosundaki '
  'DELETE RLS politikasını (0005) fiilen yalnızca "hiç kullanılmamış hesap" ile sınırlar.';

create index transaction_entries_transaction_id_idx on public.transaction_entries (transaction_id);
create index transaction_entries_book_id_idx on public.transaction_entries (book_id);
create index transaction_entries_account_id_idx on public.transaction_entries (account_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- KURAL: Sıfır toplam kontrolü YALNIZCA type='transfer' için, ve
-- ERTELENMİŞ (deferred) olarak — iki entry art arda eklenirken ara
-- durumun (henüz ikinci entry gelmeden) yanlışlıkla reddedilmesini önler.
-- Kontrol yalnızca veritabanı işleminin COMMIT anında çalışır.
-- income/expense için bu kontrol hiç uygulanmaz (kasıtlı tek taraflı).
-- ─────────────────────────────────────────────────────────────

create or replace function public.check_transfer_balance()
returns trigger
language plpgsql
security definer -- RLS'i bypass eder: cross-book transferde çağıran kullanıcı
                  -- yalnızca kendi book_id'sindeki entry'yi görebilse bile,
                  -- toplam SEC DEFINER sayesinde her iki entry üzerinden
                  -- doğru hesaplanır.
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_type text;
  v_sum bigint;
begin
  v_transaction_id := coalesce(new.transaction_id, old.transaction_id);

  select type into v_type
  from public.transactions
  where id = v_transaction_id;

  if v_type = 'transfer' then
    select coalesce(sum(amount_cents), 0) into v_sum
    from public.transaction_entries
    where transaction_id = v_transaction_id;

    if v_sum <> 0 then
      raise exception
        'Transfer islemi icin entries toplami sifir olmali (transaction_id=%, mevcut toplam=%)',
        v_transaction_id, v_sum;
    end if;
  end if;

  return null; -- AFTER trigger'da dönüş değeri kullanılmaz
end;
$$;

comment on function public.check_transfer_balance is
  'Yalnızca type=transfer olan transactions icin, ilgili tüm transaction_entries '
  'toplamının sıfır olmasını COMMIT anında zorunlu kılar. income/expense''de hiçbir '
  'kontrol uygulamaz (tek taraflı entry kasıtlıdır).';

create constraint trigger transaction_entries_transfer_balance
  after insert or update or delete on public.transaction_entries
  deferrable initially deferred
  for each row execute function public.check_transfer_balance();

-- ─────────────────────────────────────────────────────────────
-- KURAL: transactions fiziksel olarak silinmez; UPDATE yalnızca
-- status='active' -> 'cancelled' geçişine izin verir, başka hiçbir alan
-- değiştirilemez. RLS (0007) KİMİN iptal edebileceğini, bu trigger ise
-- NEYİN değişebileceğini kısıtlar.
-- ─────────────────────────────────────────────────────────────

create or replace function public.enforce_transaction_cancel_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'active' then
    raise exception
      'Yalnızca active durumundaki islemler iptal edilebilir (mevcut durum: %)', old.status;
  end if;

  if new.status <> 'cancelled' then
    raise exception
      'transactions.status yalnizca active -> cancelled yonunde guncellenebilir';
  end if;

  if new.type <> old.type
     or new.occurred_at <> old.occurred_at
     or new.metadata is distinct from old.metadata
     or new.recurring_rule_id is distinct from old.recurring_rule_id
  then
    raise exception 'Iptal disinda transactions alanlari guncellenemez';
  end if;

  new.cancelled_at := now();
  return new;
end;
$$;

create trigger transactions_enforce_cancel_only
  before update on public.transactions
  for each row execute function public.enforce_transaction_cancel_only();

comment on function public.enforce_transaction_cancel_only is
  'transactions UPDATE''i yalnızca status: active->cancelled geçişine izin verir; '
  'diğer tüm alanların değişmesini reddeder. Bu, "finansal kayıtlar silinmez, '
  'yalnızca iptal edilir" ilkesinin UPDATE tarafındaki karşılığıdır.';
