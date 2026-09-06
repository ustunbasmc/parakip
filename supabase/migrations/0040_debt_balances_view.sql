-- 0040_debt_balances_view.sql
-- Amaç: Her borç/alacağın ödenen ve kalan tutarını hesaplayan bir view.
-- account_balances (0039) ile AYNI DESENİ izler: canlı hesaplama,
-- security_invoker=true (RLS gerçek çağıran kullanıcı bağlamında
-- uygulanır — bu olmadan view sahibinin yetkileriyle çalışıp RLS'i
-- fiilen atlardı).

create view public.debt_balances
  with (security_invoker = true)
as
select
  d.id as debt_id,
  d.book_id,
  d.counterparty_name,
  d.direction,
  d.principal_cents,
  d.due_date,
  d.status,
  d.note,
  coalesce((
    select sum(dp.amount_cents)
    from public.debt_payments dp
    where dp.debt_id = d.id and dp.status = 'active'
  ), 0) as paid_cents,
  d.principal_cents - coalesce((
    select sum(dp.amount_cents)
    from public.debt_payments dp
    where dp.debt_id = d.id and dp.status = 'active'
  ), 0) as remaining_cents
from public.debts d;

comment on view public.debt_balances is
  'Her borç/alacağın ödenen ve kalan tutarı (iptal edilmiş ödemeler hariç). '
  'security_invoker=true sayesinde RLS gerçek çağıran kullanıcı bağlamında '
  'uygulanır.';

grant select on public.debt_balances to authenticated;
