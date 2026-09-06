-- 0039_account_balances_view.sql
-- Amaç: Her hesabın CANLI bakiyesini (açılış + aktif entries toplamı)
-- hesaplayan bir view. Dashboard'daki "toplam bakiye" gibi kartlar bunu
-- tekrar tekrar elle hesaplamak yerine burayı kullanır.
--
-- security_invoker=true KRİTİKTİR (bkz. 0025'teki aynı gerekçe): olmadan
-- view, sahibinin (RLS'i bypass eden) yetkileriyle çalışır ve kullanıcılar
-- birbirinin hesap bakiyelerini görebilirdi.

create view public.account_balances
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
  a.opening_balance_cents + coalesce(active_sum.total, 0) as balance_cents
from public.accounts a
left join lateral (
  select sum(te.amount_cents) as total
  from public.transaction_entries te
  join public.transactions t on t.id = te.transaction_id
  where te.account_id = a.id
    and t.status = 'active'
) active_sum on true;

comment on view public.account_balances is
  'Her hesabın canlı bakiyesi (açılış + aktif entries toplamı). İptal '
  'edilen işlemler dahil edilmez. security_invoker=true ile RLS gerçek '
  'çağıran kullanıcı bağlamında uygulanır.';

grant select on public.account_balances to authenticated;
