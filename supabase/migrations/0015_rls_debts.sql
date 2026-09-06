-- 0015_rls_debts.sql
-- Amaç: debts ve debt_payments için RLS. SELECT tüm defter üyelerine
-- açıktır (transactions/accounts ile aynı görünürlük düzeyi — borç kimin
-- olduğunu tüm ekip görebilmeli). INSERT/UPDATE/DELETE için HİÇBİR
-- politika VE HİÇBİR grant YOK — tüm yazma 0016'daki fonksiyonlar
-- üzerinden, tablo sahibi yetkisiyle yapılır.

alter table public.debts enable row level security;

create policy debts_select_member
  on public.debts for select
  using (public.is_book_member(book_id));

grant select on public.debts to authenticated;

alter table public.debt_payments enable row level security;

create policy debt_payments_select_member
  on public.debt_payments for select
  using (
    exists (
      select 1 from public.debts d
      where d.id = debt_payments.debt_id
        and public.is_book_member(d.book_id)
    )
  );

grant select on public.debt_payments to authenticated;
