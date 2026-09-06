-- 0034_holding_transactions_cancellation_and_fx.sql
-- Amaç: (1) holding_transactions için iptal (cancel) desteği, (2) çoklu
-- para birimi v1 alanları (kur, kur tarihi, kaynak türü, dönüşüm tutarı).
--
-- İPTAL KAPSAM SINIRI (bilinçli tasarım kararı): Bu sistem weighted-average
-- kullanır, lot bazlı (FIFO/LIFO) izleme YAPMAZ. Bu yüzden rastgele bir
-- geçmiş işlemi iptal etmek (ör. iki alıştan sonra yapılmış bir satış
-- varken İLK alışı iptal etmek) miktarı/maliyeti tutarsız hale getirebilir
-- (negatif miktar gibi). Bunu önlemek için iptal, YALNIZCA o holding
-- üzerindeki EN SON (LIFO) aktif işlemle sınırlandırılmıştır — bkz. 0036.
-- Bu, "geçmiş herhangi bir işlemi iptal etme" değil "son işlemi geri alma"
-- garantisi verir; genel lot-bazlı iptal ayrı bir round'un kapsamıdır.

alter table public.holding_transactions
  add column status text not null default 'active' check (status in ('active', 'cancelled')),
  add column cancelled_at timestamptz;

comment on column public.holding_transactions.status is
  'active/cancelled. İptal edilen işlemler holdings.quantity/'
  'total_cost_basis_cents/realized_gain_cents hesaplamalarına dahil edilmez '
  '(cancel_holding_transaction() bu değerleri iptal anında GERİ HESAPLAR, '
  'yalnızca işaretlemekle kalmaz).';

-- "Yalnızca iptal edilebilir" kuralı — projede kurulu desenle birebir aynı.
create or replace function public.enforce_holding_transaction_cancel_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status <> 'active' then
    raise exception 'Yalnizca active durumdaki islemler iptal edilebilir (mevcut: %)', old.status;
  end if;

  if new.status <> 'cancelled' then
    raise exception 'holding_transactions.status yalnizca active -> cancelled yonunde guncellenebilir';
  end if;

  if new.holding_id <> old.holding_id
     or new.transaction_id <> old.transaction_id
     or new.type <> old.type
     or new.quantity <> old.quantity
     or new.price_cents <> old.price_cents
     or new.realized_gain_cents is distinct from old.realized_gain_cents
  then
    raise exception 'Iptal disinda holding_transactions alanlari guncellenemez';
  end if;

  new.cancelled_at := now();
  return new;
end;
$$;

create trigger holding_transactions_enforce_cancel_only
  before update on public.holding_transactions
  for each row execute function public.enforce_holding_transaction_cancel_only();

-- ─────────────────────────────────────────────
-- ÇOKLU PARA BİRİMİ v1 ALANLARI
--
-- KURAL: Alış/satış işleminin varlık para birimi (holdings.currency),
-- nakit hesabının para birimiyle (accounts.currency) FARKLIYSA, bu dört
-- alanın TAMAMI zorunludur (create_investment_buy/sell fonksiyonlarında
-- kontrol edilir, bkz. 0035). Aynı para biriminde ise bu alanların TAMAMI
-- NULL kalır. "Hepsi ya da hiçbiri" kuralı burada CHECK kısıtıyla da
-- veritabanı seviyesinde zorlanır (çift güvenlik ağı).
-- ─────────────────────────────────────────────

alter table public.holding_transactions
  add column fx_rate numeric,
  add column fx_rate_date date,
  add column fx_rate_source text check (fx_rate_source in ('manual', 'provider')),
  add column converted_amount_cents bigint;

alter table public.holding_transactions
  add constraint holding_transactions_fx_fields_all_or_nothing
  check (
    (fx_rate is null and fx_rate_date is null and fx_rate_source is null and converted_amount_cents is null)
    or
    (fx_rate is not null and fx_rate_date is not null and fx_rate_source is not null and converted_amount_cents is not null)
  );

comment on column public.holding_transactions.fx_rate is
  'Yalnızca varlık para birimi ile hesap para birimi FARKLIYSA doludur. '
  '1 birim varlık para biriminin, hesap para biriminde karşılığıdır '
  '(account_currency_tutar = asset_currency_tutar * fx_rate).';
comment on column public.holding_transactions.fx_rate_source is
  '"manual" = kullanıcı elle girdi (v1''de tek gerçek yol); "provider" = '
  'otomatik bir kur sağlayıcısından (ileride, henüz uygulanmadı).';
comment on column public.holding_transactions.converted_amount_cents is
  'Hesap para biriminde GERÇEKTEN hareket eden tutar (kuruş). Bu, ledger '
  'nakit bacağı için kullanılan OTORİTER değerdir — fx_rate*tutar ile '
  'MATEMATİKSEL OLARAK BİREBİR AYNI OLMAK ZORUNDA DEĞİLDİR (gerçek '
  'dönüşümlerde spread/komisyon farkı olabilir); kullanıcı ne girmişse odur.';
