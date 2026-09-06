-- 0055_archive_account_and_cancel_transactions.sql
-- Amaç: "Hesabı arşivle ve işlemleri iptal et" akışı için TEK, ATOMİK bir
-- fonksiyon. SAF EKLEME — mevcut transactions/transaction_entries/
-- accounts/audit_log şeması ve diğer tüm fonksiyonlar (archive_account,
-- can_cancel_transaction dahil) HİÇ DEĞİŞTİRİLMEDİ. Fiziksel DELETE
-- KULLANILMAZ — yalnızca status/is_archived güncellenir.

create or replace function public.archive_account_and_cancel_transactions(p_account_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_cancelled_count integer;
begin
  select book_id into v_book_id from public.accounts where id = p_account_id;
  if v_book_id is null then
    raise exception 'Hesap bulunamadi (id=%)', p_account_id;
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  -- Bu hesaba bağlı, HÂLÂ AKTİF olan tüm işlemleri iptal eder (transfer
  -- ise karşı bacağı da AYNI transactions satırı olduğundan otomatik
  -- kapsanır — iki bacak birbirinden ayrı iptal edilmez). Fiziksel
  -- DELETE yoktur, yalnızca status='cancelled' — audit/geçmiş korunur.
  update public.transactions t
  set status = 'cancelled'
  where t.status = 'active'
    and exists (
      select 1 from public.transaction_entries te
      where te.transaction_id = t.id and te.account_id = p_account_id
    );

  get diagnostics v_cancelled_count = row_count;

  update public.accounts set is_archived = true where id = p_account_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (
    v_book_id, auth.uid(), 'archived', 'account', p_account_id,
    jsonb_build_object('cancelled_transaction_count', v_cancelled_count, 'reason', 'archive_and_cancel_transactions')
  );

  return v_cancelled_count;
end;
$$;

comment on function public.archive_account_and_cancel_transactions is
  '"Hesabı arşivle ve işlemleri iptal et" akışının TEK ATOMİK adımı: bu '
  'hesaba bağlı tüm AKTİF işlemleri iptal eder (fiziksel silme YOK, '
  'yalnızca status=cancelled) ve hesabı arşivler — hepsi TEK transaction''da. '
  'Dönen değer, iptal edilen işlem sayısıdır. Yalnızca owner/admin '
  'çağırabilir. Bu turda ayrıca uygulama tarafında şifre ile yeniden '
  'doğrulama ve yazılı onay ("HESABI ARŞİVLE") istenir — bu fonksiyon '
  'yalnızca veritabanı seviyesindeki ATOMİKLİK ve yetki garantisini sağlar.';

revoke all on function public.archive_account_and_cancel_transactions(uuid) from public;
grant execute on function public.archive_account_and_cancel_transactions(uuid) to authenticated;
