-- 0010_update_create_transfer_with_audit.sql
-- Amaç: create_transfer()'ı, artık var olan audit_log'a HER DEFTER İÇİN
-- AYRI bir "created" satırı yazacak şekilde güncellemek. İmza (parametre
-- listesi) DEĞİŞMEDİ — CREATE OR REPLACE, mevcut GRANT/REVOKE'ları korur.

create or replace function public.create_transfer(
  p_from_book_id uuid,
  p_from_account_id uuid,
  p_to_book_id uuid,
  p_to_account_id uuid,
  p_amount_cents bigint,
  p_currency text default 'TRY',
  p_occurred_at timestamptz default now(),
  p_from_note text default null,
  p_to_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_from_entry_id uuid;
  v_to_entry_id uuid;
  v_actor uuid := auth.uid();
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'p_amount_cents pozitif bir tutar olmalidir (kuruş, integer)';
  end if;

  if p_from_book_id = p_to_book_id and p_from_account_id = p_to_account_id then
    raise exception 'Kaynak ve hedef hesap ayni olamaz';
  end if;

  if not public.has_book_role(p_from_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Kaynak defter icin yetkiniz yok (book_id=%)', p_from_book_id;
  end if;

  if not public.has_book_role(p_to_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Hedef defter icin yetkiniz yok (book_id=%)', p_to_book_id;
  end if;

  insert into public.transactions (type, occurred_at, metadata)
  values ('transfer', p_occurred_at, p_metadata)
  returning id into v_transaction_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, currency, note)
  values
    (v_transaction_id, p_from_book_id, p_from_account_id, -p_amount_cents, p_currency, p_from_note)
  returning id into v_from_entry_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, currency, note)
  values
    (v_transaction_id, p_to_book_id, p_to_account_id, p_amount_cents, p_currency, p_to_note)
  returning id into v_to_entry_id;

  -- Her defter için AYRI audit satırı. Her satır YALNIZCA kendi
  -- deftere ait entry bilgisini taşır — karşı tarafın hesap adı,
  -- tutarı, notu veya kullanıcı kimliği bu satıra ASLA yazılmaz.
  insert into public.audit_log
    (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values
    (p_from_book_id, v_actor, 'created', 'transaction_entry', v_from_entry_id, v_transaction_id,
     jsonb_build_object('account_id', p_from_account_id, 'amount_cents', -p_amount_cents,
                         'currency', p_currency, 'note', p_from_note));

  insert into public.audit_log
    (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values
    (p_to_book_id, v_actor, 'created', 'transaction_entry', v_to_entry_id, v_transaction_id,
     jsonb_build_object('account_id', p_to_account_id, 'amount_cents', p_amount_cents,
                         'currency', p_currency, 'note', p_to_note));

  return v_transaction_id;
end;
$$;

comment on function public.create_transfer is
  'Aynı defter içi, Ev-İşletme (cross-book) veya kredi kartı ödemesi transferini '
  'tek çağrıda, tek veritabanı işleminde, iki entry VE her defter için ayrı bir '
  'audit_log satırıyla atomik olarak oluşturur. Herhangi bir adım başarısız olursa '
  '(ör. geçersiz account_id) fonksiyonun TÜM etkileri (header + entries + audit) '
  'geri alınır — kısmi/tutarsız kayıt oluşmaz.';
