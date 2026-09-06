-- 0025_budget_usage_view.sql
-- Amaç: Her bütçe için kullanılan tutarı ve uyarı seviyesini (ok/
-- warning_80/exceeded) hesaplayan bir görünüm. Gerçek bildirim gönderimi
-- (push/e-posta) bu görünümün dışında, ayrı bir modülün kapsamındadır —
-- burada yalnızca "hangi bütçeler eşiği geçti" sorusu cevaplanıyor
-- (borç modülündeki "vade bildirimi" sorgusuyla aynı yaklaşım).
--
-- ÖNEMLİ: security_invoker = true KRİTİKTİR. Bu olmadan (PostgreSQL 15
-- öncesi varsayılan davranış), view sorgusu VIEW SAHİBİNİN (genellikle
-- postgres, RLS'i bypass eden bir tablo sahibi) yetkileriyle çalışır ve
-- alttaki tablolardaki RLS'i FİİLEN ATLAR — bu da bir kullanıcının başka
-- kullanıcıların bütçe verilerini görebileceği ciddi bir sızıntı olurdu.
-- security_invoker = true, sorgunun GERÇEK ÇAĞIRAN KULLANICININ RLS
-- bağlamında çalışmasını garanti eder.

create view public.budget_usage
  with (security_invoker = true)
as
select
  b.id as budget_id,
  b.book_id,
  b.category_id,
  b.period_month,
  b.amount_cents as budget_cents,
  coalesce(u.used_cents, 0) as used_cents,
  case
    when b.amount_cents > 0
      then round((coalesce(u.used_cents, 0)::numeric / b.amount_cents::numeric) * 100, 2)
    else 0
  end as percent_used,
  case
    when coalesce(u.used_cents, 0) >= b.amount_cents then 'exceeded'
    when coalesce(u.used_cents, 0) >= (b.amount_cents * 0.8) then 'warning_80'
    else 'ok'
  end as alert_level
from public.budgets b
left join lateral (
  select -sum(te.amount_cents) as used_cents
  from public.transaction_entries te
  join public.transactions t on t.id = te.transaction_id
  where te.book_id = b.book_id
    and t.type = 'expense'
    and t.status = 'active'
    and (b.category_id is null or te.category_id = b.category_id)
    and date_trunc('month', t.occurred_at) = date_trunc('month', b.period_month)
) u on true
where b.status = 'active';

comment on view public.budget_usage is
  'Her aktif bütçe için kullanılan tutar (yalnızca aktif gider entry''lerinden, '
  'iptal edilenler hariç) ve uyarı seviyesi (ok/warning_80/exceeded). '
  'category_id NULL olan (toplam) bütçelerde used_cents, o ay/deftere ait '
  'TÜM aktif giderlerin toplamıdır — kategori bütçelerinin toplamından '
  'TÜRETİLMEZ (bkz. 0022''deki çift sayım notu). security_invoker=true '
  'sayesinde RLS gerçek çağıran kullanıcı bağlamında uygulanır.';

grant select on public.budget_usage to authenticated;
