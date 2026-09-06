-- 0041_account_archiving.sql
-- Amaç: Hesaplar ekranı için üç EKLEME (hiçbir mevcut politika/fonksiyon
-- DEĞİŞTİRİLMİYOR):
--
-- 1) audit_log.entity_type'a 'account' eklenir (action zaten 'updated'
--    içeriyor, ona dokunulmuyor).
-- 2) accounts.opening_balance_cents için: negatif yalnızca 'credit_card'
--    türünde hesaplarda mümkün (borç niteliğindeki tek hesap türümüz).
-- 3) archive_account(): mevcut accounts_update_editor_plus RLS politikası
--    editor'a da genel UPDATE izni veriyor (bu DEĞİŞTİRİLMİYOR — editor'un
--    başka alanları güncelleyebilmesi gerekebilir), ama arşivleme
--    işleminin YALNIZCA owner/admin tarafından yapılabilmesi için bu
--    SECURITY DEFINER fonksiyon üzerinden dar bir yol açılıyor. Uygulama
--    kodu arşivleme için HER ZAMAN bu fonksiyonu kullanır, asla doğrudan
--    "update accounts set is_archived" yapmaz.

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment', 'budget', 'holding_transaction', 'account'));

alter table public.accounts add constraint accounts_negative_opening_balance_credit_card_only
  check (opening_balance_cents >= 0 or type = 'credit_card');

comment on constraint accounts_negative_opening_balance_credit_card_only on public.accounts is
  'Negatif açılış bakiyesi yalnızca kredi kartı (borç niteliğindeki tek '
  'hesap türümüz) için anlamlıdır — diğer türlerde negatif açılış bakiyesi '
  'muhtemelen bir veri girişi hatasıdır.';

create or replace function public.archive_account(
  p_account_id uuid,
  p_archived boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_before boolean;
begin
  select book_id, is_archived into v_book_id, v_before
  from public.accounts
  where id = p_account_id;

  if v_book_id is null then
    raise exception 'Hesap bulunamadi (id=%)', p_account_id;
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  if v_before = p_archived then
    if p_archived then
      raise exception 'Bu hesap zaten arsivlenmis';
    else
      raise exception 'Bu hesap zaten aktif';
    end if;
  end if;

  update public.accounts
  set is_archived = p_archived, updated_at = now()
  where id = p_account_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'account', p_account_id,
    jsonb_build_object('is_archived', v_before),
    jsonb_build_object('is_archived', p_archived)
  );
end;
$$;

comment on function public.archive_account is
  'Bir hesabı arşivler/arşivden çıkarır. Yalnızca owner/admin çağırabilir '
  '— mevcut accounts_update_editor_plus RLS politikası (editor''a genel '
  'UPDATE izni verir) buradan ETKİLENMEZ/DEĞİŞMEZ; uygulama kodu arşivleme '
  'için HER ZAMAN bu fonksiyonu kullanır.';

revoke all on function public.archive_account(uuid, boolean) from public;
grant execute on function public.archive_account(uuid, boolean) to authenticated;
