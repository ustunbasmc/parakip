-- 0043_account_balances_note.sql
-- Amaç: account_balances view'ı, 0042'de eklenen accounts.note sütunundan
-- ÖNCE tanımlandığı için bu sütunu içermiyor (view'lar açık sütun
-- listesiyle tanımlıysa alttaki tablo değişikliklerini otomatik almaz).
-- Hesap detay ekranının açıklamayı gösterebilmesi için view yeniden
-- tanımlanıyor — CREATE OR REPLACE VIEW ile, hiçbir mevcut sütun/davranış
-- kaldırılmadan yalnızca 'note' eklenir.

create or replace view public.account_balances
  with (security_invoker = true)
as
select
  a.id as account_id,
  a.book_id,
  a.name,
  a.type,
  a.currency,
  a.is_archived,
  a.opening_balance_cents,
  a.opening_balance_cents + coalesce(active_sum.total, 0) as balance_cents,
  a.note
from public.accounts a
left join lateral (
  select sum(te.amount_cents) as total
  from public.transaction_entries te
  join public.transactions t on t.id = te.transaction_id
  where te.account_id = a.id
    and t.status = 'active'
) active_sum on true;

comment on view public.account_balances is
  'Her hesabın canlı bakiyesi (açılış + aktif entries toplamı) ve '
  'açıklaması. İptal edilen işlemler dahil edilmez. security_invoker=true '
  'ile RLS gerçek çağıran kullanıcı bağlamında uygulanır.';
