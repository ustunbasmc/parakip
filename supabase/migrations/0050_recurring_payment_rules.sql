-- 0050_recurring_payment_rules.sql
-- Amaç: "Planlı ödemeler" için tekrarlayan ödeme kuralları. SAF EKLEME —
-- mevcut debts/debt_payments şeması, create_debt/update_debt/cancel_debt/
-- create_debt_payment/cancel_debt_payment fonksiyonları HİÇ DEĞİŞTİRİLMEDİ.
-- Bir kural "vadesi geldiğinde" YENİ bir debts satırı üretir — kuralın
-- kendisi asla silinmez (is_active ile devre dışı bırakılır), ürettiği
-- borçlar sıradan borçlar gibi normal akışta (ödeme/iptal) yönetilir.

create table public.recurring_payment_rules (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  counterparty_name text not null,
  direction text not null check (direction in ('payable', 'receivable')),
  amount_cents bigint not null check (amount_cents > 0),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  -- monthly icin ayin gunu (1-28 - kisa aylarda tasma olmasin diye
  -- bilincli olarak 28 ile sinirli); weekly icin haftanin gunu (0=Pazar).
  day_of_month smallint check (day_of_month between 1 and 28),
  day_of_week smallint check (day_of_week between 0 and 6),
  next_due_date date not null,
  note text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (frequency = 'monthly' and day_of_month is not null and day_of_week is null)
    or
    (frequency = 'weekly' and day_of_week is not null and day_of_month is null)
  )
);

comment on table public.recurring_payment_rules is
  'Tekrarlayan ödeme/tahsilat kuralları (ör. "her ayın 5''i kira 8000 TL"). '
  'Vadesi geldiğinde generate_due_recurring_debts() bu kuraldan YENİ bir '
  'debts satırı üretir ve next_due_date''i ileri alır. Kural fiziksel '
  'olarak silinmez — yalnızca is_active=false ile durdurulur.';

create index recurring_payment_rules_book_id_idx on public.recurring_payment_rules (book_id);
create index recurring_payment_rules_due_idx on public.recurring_payment_rules (next_due_date) where is_active = true;

alter table public.recurring_payment_rules enable row level security;

create policy recurring_payment_rules_select_member
  on public.recurring_payment_rules for select
  using (public.is_book_member(book_id));

grant select on public.recurring_payment_rules to authenticated;
-- debts ile AYNI desen: INSERT/UPDATE için istemciye HİÇBİR doğrudan
-- politika/grant yok — tüm yazma aşağıdaki SECURITY DEFINER fonksiyonları
-- üzerindendir.

-- ─────────────────────────────────────────────
-- create_recurring_payment_rule
-- ─────────────────────────────────────────────
create or replace function public.create_recurring_payment_rule(
  p_book_id uuid,
  p_counterparty_name text,
  p_direction text,
  p_amount_cents bigint,
  p_frequency text,
  p_day_of_month smallint default null,
  p_day_of_week smallint default null,
  p_start_date date default current_date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id uuid;
  v_next date;
begin
  if p_direction not in ('payable', 'receivable') then
    raise exception 'direction "payable" veya "receivable" olmalidir';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_cents pozitif olmalidir';
  end if;

  if p_counterparty_name is null or length(trim(p_counterparty_name)) = 0 then
    raise exception 'counterparty_name bos olamaz';
  end if;

  if p_frequency not in ('weekly', 'monthly') then
    raise exception 'frequency "weekly" veya "monthly" olmalidir';
  end if;

  if p_frequency = 'monthly' then
    if p_day_of_month is null or p_day_of_month not between 1 and 28 then
      raise exception 'monthly icin day_of_month 1-28 araliginda olmalidir';
    end if;
    -- Baslangic tarihinden sonraki (bugun dahil) ilk gecerli ayin-gunu.
    v_next := date_trunc('month', p_start_date)::date + (p_day_of_month - 1);
    if v_next < p_start_date then
      v_next := (date_trunc('month', p_start_date) + interval '1 month')::date + (p_day_of_month - 1);
    end if;
  else
    if p_day_of_week is null or p_day_of_week not between 0 and 6 then
      raise exception 'weekly icin day_of_week 0-6 araliginda olmalidir';
    end if;
    v_next := p_start_date + ((p_day_of_week - extract(dow from p_start_date)::int + 7) % 7);
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  insert into public.recurring_payment_rules
    (book_id, counterparty_name, direction, amount_cents, frequency, day_of_month, day_of_week, next_due_date, note, created_by)
  values
    (p_book_id, trim(p_counterparty_name), p_direction, p_amount_cents, p_frequency, p_day_of_month, p_day_of_week, v_next, p_note, auth.uid())
  returning id into v_rule_id;

  return v_rule_id;
end;
$$;

revoke all on function public.create_recurring_payment_rule(uuid, text, text, bigint, text, smallint, smallint, date, text) from public;
grant execute on function public.create_recurring_payment_rule(uuid, text, text, bigint, text, smallint, smallint, date, text) to authenticated;

-- ─────────────────────────────────────────────
-- set_recurring_payment_rule_active — durdur/yeniden başlat (owner/admin).
-- ─────────────────────────────────────────────
create or replace function public.set_recurring_payment_rule_active(
  p_rule_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  select book_id into v_book_id from public.recurring_payment_rules where id = p_rule_id;

  if v_book_id is null then
    raise exception 'Kural bulunamadi (id=%)', p_rule_id;
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  update public.recurring_payment_rules
  set is_active = p_is_active, updated_at = now()
  where id = p_rule_id;
end;
$$;

revoke all on function public.set_recurring_payment_rule_active(uuid, boolean) from public;
grant execute on function public.set_recurring_payment_rule_active(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- generate_due_recurring_debts — ZAMANLANMIŞ GÖREV GEREKTİRİR. Vadesi
-- gelmiş (next_due_date <= bugün) her aktif kural için create_debt() İLE
-- AYNI DOĞRULAMALARI (yön/tutar) uygulayarak YENİ bir debts satırı üretir
-- ve next_due_date'i bir sonraki döneme ilerletir. create_debt()'in
-- KENDİSİ ÇAĞRILMAZ çünkü o fonksiyon auth.uid() bazlı has_book_role
-- kontrolü yapar — zamanlanmış bir görev bağlamında GERÇEK bir oturum
-- kullanıcısı YOKTUR (auth.uid() NULL döner). Bunun yerine yetkilendirme
-- kuralın OLUŞTURULDUĞU ANDA zaten yapılmıştı (bkz. create_recurring_
-- payment_rule) — bu fonksiyon yalnızca service_role bağlamından
-- çalışacağı için ayrıca auth.uid() kontrolüne gerek yoktur.
--
-- İDEMPOTENTTİR: next_due_date HER üretimden sonra ileri alındığı için
-- aynı dönem için asla iki kez borç üretilmez; görev aynı gün birden
-- fazla kez çalıştırılsa bile (next_due_date artık gelecekte olduğundan)
-- ikinci çalıştırma o kural için hiçbir şey üretmez.
-- ─────────────────────────────────────────────
create or replace function public.generate_due_recurring_debts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_rule record;
  v_debt_id uuid;
  v_count integer := 0;
  v_iterations integer;
  v_next date;
begin
  for v_rule in
    select * from public.recurring_payment_rules
    where is_active = true and next_due_date <= v_today
  loop
    v_iterations := 0;

    -- Aradan birden fazla donem gecmis olabilir (ör. uygulama uzun sure
    -- calistirilmadiysa) - her biri icin AYRI bir borc uretilir, sonsuz
    -- donguye karsi guvenlik siniri (60 donem) konur.
    while v_rule.next_due_date <= v_today and v_iterations < 60 loop
      insert into public.debts (book_id, counterparty_name, direction, principal_cents, due_date, note)
      values (
        v_rule.book_id, v_rule.counterparty_name, v_rule.direction, v_rule.amount_cents,
        v_rule.next_due_date,
        coalesce(v_rule.note || ' ', '') || '(tekrarlayan kural)'
      )
      returning id into v_debt_id;

      insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
      values (
        v_rule.book_id, v_rule.created_by, 'created', 'debt', v_debt_id,
        jsonb_build_object('source', 'recurring_payment_rule', 'rule_id', v_rule.id)
      );

      v_count := v_count + 1;

      if v_rule.frequency = 'monthly' then
        v_next := (date_trunc('month', v_rule.next_due_date) + interval '1 month')::date + (v_rule.day_of_month - 1);
      else
        v_next := v_rule.next_due_date + 7;
      end if;

      v_rule.next_due_date := v_next;
      v_iterations := v_iterations + 1;
    end loop;

    update public.recurring_payment_rules
    set next_due_date = v_rule.next_due_date, updated_at = now()
    where id = v_rule.id;
  end loop;

  return v_count;
end;
$$;

comment on function public.generate_due_recurring_debts is
  'ZAMANLANMIŞ GÖREV GEREKTİRİR — hiçbir trigger''a bağlı değildir, otomatik '
  'çalışmaz. Günde bir kez service_role ile çağrılması tasarlanmıştır (ör. '
  'bildirim zamanlayıcısıyla AYNI pg_cron/harici zamanlayıcı mekanizması, '
  'ayrı bir görev olarak eklenir). "Bugün" Europe/Istanbul saat dilimine '
  'göre hesaplanır. İDEMPOTENTTİR (bkz. yukarıdaki gövde yorumu).';

revoke all on function public.generate_due_recurring_debts() from public;
grant execute on function public.generate_due_recurring_debts() to service_role;
