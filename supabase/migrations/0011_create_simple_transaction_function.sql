-- 0011_create_simple_transaction_function.sql
-- Amaç: income/expense oluşturmayı, create_transfer()'ın transfer için
-- yaptığı gibi, TEK fonksiyon çağrısında/TEK veritabanı işleminde atomik
-- hale getirmek (header + tek entry + audit_log). Bu, önceki turda
-- "bilinen risk" olarak işaretlenen eksikliği kapatır.

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
security definer -- create_transfer ile aynı gerekçe: header+entry+audit'i
                  -- çağıranın RLS görünürlüğünden bağımsız atomik yazabilmek
                  -- için; yetki kontrolü bu yüzden aşağıda MANUEL yapılır.
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_entry_id uuid;
begin
  if p_type not in ('income', 'expense') then
    raise exception
      'create_simple_transaction yalnizca income/expense icindir; transfer icin create_transfer kullanin';
  end if;

  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'p_amount_cents sifir olamaz';
  end if;

  -- İşaret kuralı type ile tutarlı olmak zorunda: bu, yanlış işaretle
  -- (ör. gidere pozitif tutar) yanlışlıkla hesap bakiyesini bozacak bir
  -- kaydın veritabanı seviyesinde önüne geçer.
  if p_type = 'income' and p_amount_cents <= 0 then
    raise exception 'income islemlerinde amount_cents pozitif olmalidir';
  end if;

  if p_type = 'expense' and p_amount_cents >= 0 then
    raise exception 'expense islemlerinde amount_cents negatif olmalidir';
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  insert into public.transactions (type, occurred_at, metadata)
  values (p_type, p_occurred_at, p_metadata)
  returning id into v_transaction_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, category_id, note)
  values
    (v_transaction_id, p_book_id, p_account_id, p_amount_cents, p_category_id, p_note)
  returning id into v_entry_id;

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
  'zorundadır (income>0, expense<0). Herhangi bir adım başarısız olursa '
  '(ör. FK ihlali, yetki reddi) fonksiyonun TÜM etkileri geri alınır.';

revoke all on function public.create_simple_transaction(
  uuid, uuid, text, bigint, uuid, text, timestamptz, jsonb
) from public;

grant execute on function public.create_simple_transaction(
  uuid, uuid, text, bigint, uuid, text, timestamptz, jsonb
) to authenticated;
