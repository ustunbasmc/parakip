-- 0023_rls_budgets.sql
-- Amaç: budgets için RLS. SELECT tüm defter üyelerine açık (transactions/
-- debts ile aynı görünürlük düzeyi). INSERT/UPDATE/DELETE için HİÇBİR
-- politika/grant yok — tüm yazma 0024'teki fonksiyonlar üzerinden yapılır.

alter table public.budgets enable row level security;

create policy budgets_select_member
  on public.budgets for select
  using (public.is_book_member(book_id));

grant select on public.budgets to authenticated;
