-- 0028_create_simple_transaction_category_check.sql
-- Amaç: create_simple_transaction()'a, create_budget()'te zaten kullanılan
-- kategori-defter eşleşme kontrolünü eklemek. İmza DEĞİŞMEDİ (parametre
-- tipleri aynı), bu yüzden CREATE OR REPLACE yeterli, mevcut GRANT korunur.
--
-- KURAL:
--   - category_id NULL ise: serbest, hiçbir kontrol yapılmaz.
--   - categories.book_id NULL ise: global kategori, HER defterde kabul edilir.
--   - categories.book_id = p_book_id ise: aynı deftere ait, kabul edilir.
--   - categories.book_id başka bir deftere aitse: KESİN OLARAK REDDEDİLİR.
--
-- Bu kontrol burada (fonksiyon seviyesinde, erken ve anlamlı hata mesajıyla)
-- YAPILIR, ayrıca 0027'deki trigger ile VERİTABANI SEVİYESİNDE de tekrar
-- doğrulanır (çift güvenlik ağı — create_transfer/check_transfer_balance
-- ile aynı felsefe).

create or replace function public.create_simple_transaction(
  p_book_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_category_id uuid default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_entry_id uuid;
  v_category_book_id uuid;
begin
  if p_type not in ('income', 'expense') then
    raise exception
      'create_simple_transaction yalnizca income/expense icindir; transfer icin create_transfer kullanin';
  end if;

  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'p_amount_cents sifir olamaz';
  end if;

  if p_type = 'income' and p_amount_cents <= 0 then
    raise exception 'income islemlerinde amount_cents pozitif olmalidir';
  end if;

  if p_type = 'expense' and p_amount_cents >= 0 then
    raise exception 'expense islemlerinde amount_cents negatif olmalidir';
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  -- KATEGORİ-DEFTER EŞLEŞME KONTROLÜ (yeni).
  if p_category_id is not null then
    select book_id into v_category_book_id
    from public.categories
    where id = p_category_id;

    if not found then
      raise exception 'Kategori bulunamadi (id=%)', p_category_id;
    end if;

    if v_category_book_id is not null and v_category_book_id <> p_book_id then
      raise exception
        'Bu kategori baska bir deftere ait, bu defterde kullanilamaz (category_id=%, book_id=%)',
        p_category_id, p_book_id;
    end if;
    -- v_category_book_id NULL ise (global kategori) hiçbir ek kontrol
    -- yapılmaz — her defterde serbestçe kullanılabilir.
  end if;

  insert into public.transactions (type, occurred_at, metadata)
  values (p_type, p_occurred_at, p_metadata)
  returning id into v_transaction_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, category_id, note)
  values
    (v_transaction_id, p_book_id, p_account_id, p_amount_cents, p_category_id, p_note)
  returning id into v_entry_id;
  -- Bu INSERT, 0027'deki transaction_entries_enforce_category_book_match
  -- trigger'ını da tetikler — yukarıdaki kontrol atlansa/kaldırılsa bile
  -- trigger yine reddedecektir.

  insert into public.audit_log
    (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values
    (p_book_id, auth.uid(), 'created', 'transaction_entry', v_entry_id, v_transaction_id,
     jsonb_build_object('account_id', p_account_id, 'amount_cents', p_amount_cents,
                         'category_id', p_category_id, 'note', p_note));

  return v_transaction_id;
end;
$$;

comment on function public.create_simple_transaction is
  'income/expense islemini header+entry+audit ile tek veritabanı işleminde '
  'atomik olarak oluşturur. amount_cents işareti type ile tutarlı olmak '
  'zorundadır (income>0, expense<0). category_id verilirse: NULL serbest, '
  'global (book_id NULL) her defterde kabul, farklı deftere ait kategori '
  'KESİN REDDEDİLİR (hem burada hem 0027''deki trigger''da doğrulanır).';
