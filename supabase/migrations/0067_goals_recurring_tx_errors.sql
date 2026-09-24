-- 0067_goals_recurring_tx_errors.sql
-- Amaç:
--   1) Birikim hedefleri (savings_goals + katkılar). Katkılar hesap
--      bakiyesini DEĞİŞTİRMEZ; "bu hedef için ayırdım" kaydıdır.
--      Ücretsiz planda alan başına 1 aktif hedef, Premium'da sınırsız.
--   2) Tekrarlayan gelir/gider kuralları (recurring_transaction_rules):
--      vadesi gelen kural, create_simple_transaction ile AYNI tablolara
--      (transactions + transaction_entries + audit_log) kayıt üretir.
--      Mevcut tetikleyiciler (kategori-defter eşleşmesi, aylık işlem
--      limiti) aynen çalışır; bir kural hata verirse diğerleri etkilenmez.
--   3) Hata kayıtları (app_error_events): istemci ve sunucu hataları,
--      parmak izi (fingerprint) bazında gruplanır. Yalnızca service_role.
--   4) Yardım Merkezi makaleleri.
-- Mevcut finansal tabloların şeması ve RPC'leri DEĞİŞTİRİLMEZ.

-- ─────────────────────────────────────────────
-- 0) audit_log: yeni kayıt türleri (mevcut değerler korunur)
-- ─────────────────────────────────────────────
alter table public.audit_log drop constraint if exists audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment', 'budget', 'holding_transaction', 'account', 'space', 'category',
                         'savings_goal', 'recurring_transaction_rule'));

-- Alanın Premium olup olmadığı (Ev: sahibin Ev Premium'u, İşletme: alanın aboneliği).
create or replace function public.is_book_premium(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case
    when s.type = 'home' then public.has_home_premium(s.owner_user_id)
    else public.has_business_subscription(s.id)
  end
  from public.books b join public.spaces s on s.id = b.space_id
  where b.id = p_book_id;
$$;
revoke all on function public.is_book_premium(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 1) Birikim hedefleri
-- ─────────────────────────────────────────────
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  target_cents bigint not null check (target_cents > 0 and target_cents <= 100000000000),
  currency text not null default 'TRY',
  target_date date,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_by uuid references auth.users (id) on delete set null,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists savings_goals_book_idx on public.savings_goals (book_id, status);

create table if not exists public.savings_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0 and abs(amount_cents) <= 100000000000),
  note text check (note is null or char_length(note) <= 200),
  contributed_on date not null default ((now() at time zone 'Europe/Istanbul')::date),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists savings_goal_contributions_goal_idx on public.savings_goal_contributions (goal_id, contributed_on desc);

comment on table public.savings_goals is
  'Birikim hedefleri. Katkılar (savings_goal_contributions) hesap bakiyesini değiştirmez; '
  'yalnızca hedef için ayrılan tutarın kaydıdır. Yazma yalnızca RPC''lerle.';

alter table public.savings_goals enable row level security;
alter table public.savings_goal_contributions enable row level security;

drop policy if exists savings_goals_select_member on public.savings_goals;
create policy savings_goals_select_member on public.savings_goals
  for select using (public.is_book_member(book_id));

drop policy if exists savings_goal_contributions_select_member on public.savings_goal_contributions;
create policy savings_goal_contributions_select_member on public.savings_goal_contributions
  for select using (exists (select 1 from public.savings_goals g where g.id = goal_id and public.is_book_member(g.book_id)));

revoke all on public.savings_goals, public.savings_goal_contributions from anon, authenticated;
grant select on public.savings_goals, public.savings_goal_contributions to authenticated;

-- Hedef ilerlemesi (RLS çağıranın yetkisiyle uygulanır).
create or replace view public.savings_goal_progress
  with (security_invoker = true)
as
select g.id as goal_id, g.book_id, g.name, g.target_cents, g.currency, g.target_date, g.status,
       g.created_at, g.achieved_at,
       coalesce((select sum(c.amount_cents) from public.savings_goal_contributions c
                  where c.goal_id = g.id and c.status = 'active'), 0)::bigint as saved_cents
  from public.savings_goals g;
revoke all on public.savings_goal_progress from anon;
grant select on public.savings_goal_progress to authenticated;

create or replace function public.free_savings_goal_limit()
returns integer language sql immutable as $$ select 1 $$;

-- Kaydedilen tutara göre durumu günceller (hedefe ulaşıldı / geri düştü).
create or replace function public.refresh_savings_goal_status(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal record;
  v_saved bigint;
begin
  select * into v_goal from public.savings_goals where id = p_goal_id;
  if not found or v_goal.status = 'archived' then
    return;
  end if;
  select coalesce(sum(amount_cents), 0) into v_saved from public.savings_goal_contributions
   where goal_id = p_goal_id and status = 'active';
  if v_saved >= v_goal.target_cents and v_goal.status = 'active' then
    update public.savings_goals set status = 'achieved', achieved_at = now(), updated_at = now() where id = p_goal_id;
  elsif v_saved < v_goal.target_cents and v_goal.status = 'achieved' then
    update public.savings_goals set status = 'active', achieved_at = null, updated_at = now() where id = p_goal_id;
  end if;
end;
$$;
revoke all on function public.refresh_savings_goal_status(uuid) from public, anon, authenticated;

create or replace function public.create_savings_goal(p_book_id uuid, p_name text, p_target_cents bigint, p_target_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_active integer;
begin
  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu alanda hedef oluşturmak için yetkin yok.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Hedef adı 1-80 karakter olmalı.' using errcode = '22023';
  end if;
  if p_target_cents is null or p_target_cents <= 0 then
    raise exception 'Hedef tutarı sıfırdan büyük olmalı.' using errcode = '22023';
  end if;
  if not coalesce(public.is_book_premium(p_book_id), false) then
    select count(*) into v_active from public.savings_goals where book_id = p_book_id and status in ('active', 'achieved');
    if v_active >= public.free_savings_goal_limit() then
      raise exception 'Ücretsiz planda en fazla % birikim hedefi olabilir. Daha fazlası için Premium''a geç ya da mevcut hedefi arşivle.',
        public.free_savings_goal_limit() using errcode = 'P0001', hint = 'goal_limit';
    end if;
  end if;

  insert into public.savings_goals (book_id, name, target_cents, target_date, created_by)
  values (p_book_id, btrim(p_name), p_target_cents, p_target_date, auth.uid())
  returning id into v_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (p_book_id, auth.uid(), 'created', 'savings_goal', v_id,
          jsonb_build_object('name', btrim(p_name), 'target_cents', p_target_cents, 'target_date', p_target_date));
  return v_id;
end;
$$;

create or replace function public.update_savings_goal(p_goal_id uuid, p_name text, p_target_cents bigint, p_target_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal record;
begin
  select * into v_goal from public.savings_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Hedef bulunamadı.' using errcode = 'P0002';
  end if;
  if not public.has_book_role(v_goal.book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu hedefi düzenlemek için yetkin yok.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_target_cents is null or p_target_cents <= 0 then
    raise exception 'Geçerli bir ad ve tutar gir.' using errcode = '22023';
  end if;
  update public.savings_goals
     set name = btrim(p_name), target_cents = p_target_cents, target_date = p_target_date, updated_at = now()
   where id = p_goal_id;
  perform public.refresh_savings_goal_status(p_goal_id);
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (v_goal.book_id, auth.uid(), 'updated', 'savings_goal', p_goal_id,
          jsonb_build_object('name', v_goal.name, 'target_cents', v_goal.target_cents, 'target_date', v_goal.target_date),
          jsonb_build_object('name', btrim(p_name), 'target_cents', p_target_cents, 'target_date', p_target_date));
end;
$$;

-- Arşivle (p_archived=true) veya arşivden çıkar (limit kontrolüyle).
create or replace function public.set_savings_goal_archived(p_goal_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal record;
  v_active integer;
begin
  select * into v_goal from public.savings_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Hedef bulunamadı.' using errcode = 'P0002';
  end if;
  if not public.has_book_role(v_goal.book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu hedefi değiştirmek için yetkin yok.' using errcode = '42501';
  end if;
  if p_archived then
    if v_goal.status = 'archived' then return; end if;
    update public.savings_goals set status = 'archived', updated_at = now() where id = p_goal_id;
  else
    if v_goal.status <> 'archived' then return; end if;
    if not coalesce(public.is_book_premium(v_goal.book_id), false) then
      select count(*) into v_active from public.savings_goals where book_id = v_goal.book_id and status in ('active', 'achieved');
      if v_active >= public.free_savings_goal_limit() then
        raise exception 'Ücretsiz planda en fazla % aktif birikim hedefi olabilir.', public.free_savings_goal_limit()
          using errcode = 'P0001', hint = 'goal_limit';
      end if;
    end if;
    update public.savings_goals set status = 'active', updated_at = now() where id = p_goal_id;
    perform public.refresh_savings_goal_status(p_goal_id);
  end if;
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_goal.book_id, auth.uid(), 'updated', 'savings_goal', p_goal_id, jsonb_build_object('archived', p_archived));
end;
$$;

-- Katkı ekle (pozitif) veya hedeften çek (negatif). Toplam 0'ın altına inemez.
create or replace function public.add_savings_goal_contribution(p_goal_id uuid, p_amount_cents bigint, p_note text default null, p_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goal record;
  v_saved bigint;
  v_id uuid;
begin
  select * into v_goal from public.savings_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Hedef bulunamadı.' using errcode = 'P0002';
  end if;
  if not public.has_book_role(v_goal.book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu hedefe katkı eklemek için yetkin yok.' using errcode = '42501';
  end if;
  if v_goal.status = 'archived' then
    raise exception 'Arşivlenmiş hedefe katkı eklenemez.' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'Tutar sıfır olamaz.' using errcode = '22023';
  end if;
  select coalesce(sum(amount_cents), 0) into v_saved from public.savings_goal_contributions
   where goal_id = p_goal_id and status = 'active';
  if v_saved + p_amount_cents < 0 then
    raise exception 'Hedefte biriken tutardan fazlası çekilemez.' using errcode = '22023';
  end if;

  insert into public.savings_goal_contributions (goal_id, amount_cents, note, contributed_on, created_by)
  values (p_goal_id, p_amount_cents, nullif(btrim(coalesce(p_note, '')), ''),
          coalesce(p_date, (now() at time zone 'Europe/Istanbul')::date), auth.uid())
  returning id into v_id;
  perform public.refresh_savings_goal_status(p_goal_id);
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_goal.book_id, auth.uid(), 'updated', 'savings_goal', p_goal_id,
          jsonb_build_object('event', 'contribution_added', 'contribution_id', v_id, 'amount_cents', p_amount_cents));
  return v_id;
end;
$$;

create or replace function public.cancel_savings_goal_contribution(p_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c record;
  v_book uuid;
  v_saved bigint;
begin
  select c.*, g.book_id into v_c from public.savings_goal_contributions c
    join public.savings_goals g on g.id = c.goal_id where c.id = p_contribution_id for update of c;
  if not found then
    raise exception 'Kayıt bulunamadı.' using errcode = 'P0002';
  end if;
  v_book := v_c.book_id;
  if not public.has_book_role(v_book, array['owner', 'admin', 'editor']) then
    raise exception 'Bu kaydı iptal etmek için yetkin yok.' using errcode = '42501';
  end if;
  if v_c.status = 'cancelled' then return; end if;
  select coalesce(sum(amount_cents), 0) into v_saved from public.savings_goal_contributions
   where goal_id = v_c.goal_id and status = 'active';
  if v_saved - v_c.amount_cents < 0 then
    raise exception 'Bu kayıt iptal edilirse hedefteki tutar sıfırın altına düşer; önce sonraki çekimleri iptal et.' using errcode = '22023';
  end if;
  update public.savings_goal_contributions set status = 'cancelled', cancelled_at = now() where id = p_contribution_id;
  perform public.refresh_savings_goal_status(v_c.goal_id);
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_book, auth.uid(), 'updated', 'savings_goal', v_c.goal_id,
          jsonb_build_object('event', 'contribution_cancelled', 'contribution_id', p_contribution_id, 'amount_cents', v_c.amount_cents));
end;
$$;

create or replace function public.get_savings_goal_quota(p_book_id uuid)
returns table (used integer, goal_limit integer)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_book_member(p_book_id) then
    raise exception 'Bu alanın üyesi değilsin.' using errcode = '42501';
  end if;
  select count(*)::integer into used from public.savings_goals where book_id = p_book_id and status in ('active', 'achieved');
  goal_limit := case when coalesce(public.is_book_premium(p_book_id), false) then null else public.free_savings_goal_limit() end;
  return next;
end;
$$;

revoke all on function public.create_savings_goal(uuid, text, bigint, date) from public, anon;
revoke all on function public.update_savings_goal(uuid, text, bigint, date) from public, anon;
revoke all on function public.set_savings_goal_archived(uuid, boolean) from public, anon;
revoke all on function public.add_savings_goal_contribution(uuid, bigint, text, date) from public, anon;
revoke all on function public.cancel_savings_goal_contribution(uuid) from public, anon;
revoke all on function public.get_savings_goal_quota(uuid) from public, anon;
grant execute on function public.create_savings_goal(uuid, text, bigint, date) to authenticated;
grant execute on function public.update_savings_goal(uuid, text, bigint, date) to authenticated;
grant execute on function public.set_savings_goal_archived(uuid, boolean) to authenticated;
grant execute on function public.add_savings_goal_contribution(uuid, bigint, text, date) to authenticated;
grant execute on function public.cancel_savings_goal_contribution(uuid) to authenticated;
grant execute on function public.get_savings_goal_quota(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 2) Tekrarlayan gelir/gider kuralları
-- ─────────────────────────────────────────────
create table if not exists public.recurring_transaction_rules (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  description text not null check (char_length(btrim(description)) between 1 and 120),
  frequency text not null check (frequency in ('weekly', 'monthly')),
  day_of_month smallint check (day_of_month between 1 and 28),
  day_of_week smallint check (day_of_week between 0 and 6),
  next_due_date date not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade,
  run_count integer not null default 0,
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (frequency = 'monthly' and day_of_month is not null and day_of_week is null)
    or (frequency = 'weekly' and day_of_week is not null and day_of_month is null)
  )
);
create index if not exists recurring_transaction_rules_book_idx on public.recurring_transaction_rules (book_id);
create index if not exists recurring_transaction_rules_due_idx on public.recurring_transaction_rules (next_due_date) where is_active;

comment on table public.recurring_transaction_rules is
  'Tekrarlayan gelir/gider kuralları (ör. "her ayın 1''i maaş"). Vadesi gelince '
  'process_recurring_transaction_rule() gerçek bir gelir/gider kaydı üretir. '
  'Kural fiziksel olarak silinmez; is_active=false ile durdurulur.';

alter table public.recurring_transaction_rules enable row level security;
drop policy if exists recurring_transaction_rules_select_member on public.recurring_transaction_rules;
create policy recurring_transaction_rules_select_member on public.recurring_transaction_rules
  for select using (public.is_book_member(book_id));
revoke all on public.recurring_transaction_rules from anon, authenticated;
grant select on public.recurring_transaction_rules to authenticated;

-- Bir sonraki vade (kural mantığı 0050 ile aynı: aylıkta 1-28, haftalıkta gün).
create or replace function public.recurring_next_date(p_frequency text, p_day_of_month smallint, p_day_of_week smallint, p_from date)
returns date
language sql
immutable
as $$
  select case
    when p_frequency = 'monthly' then
      case when date_trunc('month', p_from)::date + (p_day_of_month - 1) >= p_from
           then date_trunc('month', p_from)::date + (p_day_of_month - 1)
           else (date_trunc('month', p_from) + interval '1 month')::date + (p_day_of_month - 1) end
    else p_from + ((p_day_of_week - extract(dow from p_from)::int + 7) % 7)
  end;
$$;

-- Tek kuralın vadesi gelmiş dönemlerini işler (en fazla 12 dönem).
-- Her kayıt create_simple_transaction ile aynı yapıda yazılır; aktör
-- kuralı oluşturan kişidir. Herhangi bir hata (ör. aylık işlem limiti,
-- arşivlenmiş hesap, yetkisi kalmamış kişi) kural üzerine yazılır ve
-- işlem geri alınır; diğer kurallar etkilenmez.
create or replace function public.process_recurring_transaction_rule(p_rule_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_count integer := 0;
  v_tx uuid;
  v_entry uuid;
  v_amount bigint;
  v_role text;
  v_acc record;
  v_next date;
begin
  select * into v_rule from public.recurring_transaction_rules where id = p_rule_id for update;
  if not found or not v_rule.is_active then
    return 0;
  end if;

  while v_rule.next_due_date <= v_today and v_count < 12 loop
    begin
      select sm.role into v_role
        from public.books b join public.space_members sm on sm.space_id = b.space_id
       where b.id = v_rule.book_id and sm.user_id = v_rule.created_by;
      if v_role is null or v_role not in ('owner', 'admin', 'editor') then
        raise exception 'Kuralı oluşturan kişinin bu alanda kayıt yetkisi kalmadı.';
      end if;
      select id, book_id, is_archived into v_acc from public.accounts where id = v_rule.account_id;
      if not found or v_acc.book_id <> v_rule.book_id then
        raise exception 'Kuralın hesabı bulunamadı.';
      end if;
      if v_acc.is_archived then
        raise exception 'Kuralın hesabı arşivlenmiş.';
      end if;

      v_amount := case when v_rule.type = 'expense' then -v_rule.amount_cents else v_rule.amount_cents end;

      insert into public.transactions (type, occurred_at, metadata)
      values (v_rule.type,
              (v_rule.next_due_date + time '09:00') at time zone 'Europe/Istanbul',
              jsonb_build_object('source', 'recurring_rule', 'rule_id', v_rule.id))
      returning id into v_tx;

      insert into public.transaction_entries (transaction_id, book_id, account_id, amount_cents, category_id, note)
      values (v_tx, v_rule.book_id, v_rule.account_id, v_amount, v_rule.category_id, v_rule.description)
      returning id into v_entry;

      insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
      values (v_rule.book_id, v_rule.created_by, 'created', 'transaction_entry', v_entry, v_tx,
              jsonb_build_object('account_id', v_rule.account_id, 'amount_cents', v_amount, 'category_id', v_rule.category_id,
                                 'note', v_rule.description, 'source', 'recurring_rule', 'rule_id', v_rule.id));

      v_next := public.recurring_next_date(v_rule.frequency, v_rule.day_of_month, v_rule.day_of_week, v_rule.next_due_date + 1);
      update public.recurring_transaction_rules
         set next_due_date = v_next, run_count = run_count + 1, last_run_at = now(), last_error = null, updated_at = now()
       where id = v_rule.id;
      v_rule.next_due_date := v_next;
      v_count := v_count + 1;
    exception when others then
      update public.recurring_transaction_rules
         set last_error = left(sqlerrm, 300), last_run_at = now(), updated_at = now()
       where id = v_rule.id;
      exit;
    end;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.process_recurring_transaction_rule(uuid) from public, anon, authenticated;

create or replace function public.generate_due_recurring_transactions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in
    select id from public.recurring_transaction_rules
     where is_active and next_due_date <= (now() at time zone 'Europe/Istanbul')::date
  loop
    v_total := v_total + public.process_recurring_transaction_rule(v_id);
  end loop;
  return v_total;
end;
$$;
revoke all on function public.generate_due_recurring_transactions() from public, anon, authenticated;
grant execute on function public.generate_due_recurring_transactions() to service_role;

create or replace function public.create_recurring_transaction_rule(
  p_book_id uuid,
  p_account_id uuid,
  p_category_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_description text,
  p_frequency text,
  p_day_of_month smallint default null,
  p_day_of_week smallint default null,
  p_start_date date default null
)
returns table (rule_id uuid, created_now integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_start date := coalesce(p_start_date, (now() at time zone 'Europe/Istanbul')::date);
  v_acc record;
  v_cat record;
begin
  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu alanda kural oluşturmak için yetkin yok.' using errcode = '42501';
  end if;
  if p_type not in ('income', 'expense') then
    raise exception 'Tür gelir veya gider olmalı.' using errcode = '22023';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Tutar sıfırdan büyük olmalı.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) not between 1 and 120 then
    raise exception 'Açıklama 1-120 karakter olmalı.' using errcode = '22023';
  end if;
  if p_frequency = 'monthly' and (p_day_of_month is null or p_day_of_month not between 1 and 28) then
    raise exception 'Aylık kural için ayın günü 1-28 arasında olmalı.' using errcode = '22023';
  end if;
  if p_frequency = 'weekly' and (p_day_of_week is null or p_day_of_week not between 0 and 6) then
    raise exception 'Haftalık kural için haftanın günü seçilmeli.' using errcode = '22023';
  end if;
  if p_frequency not in ('monthly', 'weekly') then
    raise exception 'Sıklık aylık veya haftalık olmalı.' using errcode = '22023';
  end if;
  select book_id, is_archived into v_acc from public.accounts where id = p_account_id;
  if not found or v_acc.book_id <> p_book_id or v_acc.is_archived then
    raise exception 'Geçerli bir hesap seç.' using errcode = '22023';
  end if;
  if p_category_id is not null then
    select book_id, kind into v_cat from public.categories where id = p_category_id;
    if not found or (v_cat.book_id is not null and v_cat.book_id <> p_book_id) or v_cat.kind <> p_type then
      raise exception 'Geçerli bir kategori seç.' using errcode = '22023';
    end if;
  end if;

  insert into public.recurring_transaction_rules
    (book_id, account_id, category_id, type, amount_cents, description, frequency, day_of_month, day_of_week, next_due_date, created_by)
  values
    (p_book_id, p_account_id, p_category_id, p_type, p_amount_cents, btrim(p_description), p_frequency,
     case when p_frequency = 'monthly' then p_day_of_month end,
     case when p_frequency = 'weekly' then p_day_of_week end,
     public.recurring_next_date(p_frequency,
       case when p_frequency = 'monthly' then p_day_of_month end,
       case when p_frequency = 'weekly' then p_day_of_week end, v_start),
     auth.uid())
  returning id into v_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (p_book_id, auth.uid(), 'created', 'recurring_transaction_rule', v_id,
          jsonb_build_object('type', p_type, 'amount_cents', p_amount_cents, 'description', btrim(p_description), 'frequency', p_frequency));

  -- Vadesi bugün (veya başlangıç geçmişte) ise ilk kayıt hemen oluşturulur.
  rule_id := v_id;
  created_now := public.process_recurring_transaction_rule(v_id);
  return next;
end;
$$;

create or replace function public.set_recurring_transaction_rule_active(p_rule_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
begin
  select * into v_rule from public.recurring_transaction_rules where id = p_rule_id for update;
  if not found then
    raise exception 'Kural bulunamadı.' using errcode = 'P0002';
  end if;
  if not (public.has_book_role(v_rule.book_id, array['owner', 'admin'])
          or (v_rule.created_by = auth.uid() and public.has_book_role(v_rule.book_id, array['editor']))) then
    raise exception 'Bu kuralı değiştirmek için yetkin yok.' using errcode = '42501';
  end if;
  if v_rule.is_active = p_active then return; end if;
  -- Yeniden etkinleştirmede geçmiş dönemler toplu üretilmez: vade bugünden itibaren hesaplanır.
  update public.recurring_transaction_rules
     set is_active = p_active,
         next_due_date = case when p_active
           then public.recurring_next_date(frequency, day_of_month, day_of_week, (now() at time zone 'Europe/Istanbul')::date)
           else next_due_date end,
         last_error = case when p_active then null else last_error end,
         updated_at = now()
   where id = p_rule_id;
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_rule.book_id, auth.uid(), 'updated', 'recurring_transaction_rule', p_rule_id, jsonb_build_object('is_active', p_active));
end;
$$;

revoke all on function public.create_recurring_transaction_rule(uuid, uuid, uuid, text, bigint, text, text, smallint, smallint, date) from public, anon;
revoke all on function public.set_recurring_transaction_rule_active(uuid, boolean) from public, anon;
grant execute on function public.create_recurring_transaction_rule(uuid, uuid, uuid, text, bigint, text, text, smallint, smallint, date) to authenticated;
grant execute on function public.set_recurring_transaction_rule_active(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- 3) Hata kayıtları
-- ─────────────────────────────────────────────
create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint) <= 64),
  source text not null check (source in ('client', 'server')),
  message text not null check (char_length(message) <= 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  path text check (path is null or char_length(path) <= 300),
  context text check (context is null or char_length(context) <= 200),
  digest text check (digest is null or char_length(digest) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  last_user_id uuid,
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists app_error_events_last_seen_idx on public.app_error_events (last_seen desc);

comment on table public.app_error_events is
  'Uygulama hataları (istemci + sunucu), parmak izine göre gruplanır. Kişisel veri '
  'tutulmaz: yol sorgu parametresiz, mesaj/iz kırpılmış, yalnızca kullanıcı kimliği. '
  'Yalnızca service_role okur/yazar. 30 günden eski kayıtlar günlük görevde silinir.';

alter table public.app_error_events enable row level security;
revoke all on public.app_error_events from anon, authenticated;

-- Aynı hata tekrarlandığında sayaç artar; çözülmüş işaretliyse yeniden açılır.
create or replace function public.record_app_error(
  p_fingerprint text, p_source text, p_message text, p_stack text, p_path text,
  p_context text, p_digest text, p_user_agent text, p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Taşma koruması: son 1 saatte 500'den fazla YENİ hata türü açıldıysa yenisi eklenmez.
  if not exists (select 1 from public.app_error_events where fingerprint = p_fingerprint)
     and (select count(*) from public.app_error_events where first_seen > now() - interval '1 hour') >= 500 then
    return;
  end if;
  insert into public.app_error_events (fingerprint, source, message, stack, path, context, digest, user_agent, last_user_id)
  values (left(p_fingerprint, 64), p_source, left(coalesce(p_message, 'Bilinmeyen hata'), 500), left(p_stack, 4000),
          left(p_path, 300), left(p_context, 200), left(p_digest, 100), left(p_user_agent, 300), p_user_id)
  on conflict (fingerprint) do update
     set occurrences = app_error_events.occurrences + 1,
         last_seen = now(),
         last_user_id = coalesce(excluded.last_user_id, app_error_events.last_user_id),
         path = excluded.path,
         resolved_at = null;
end;
$$;
revoke all on function public.record_app_error(text, text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_app_error(text, text, text, text, text, text, text, text, uuid) to service_role;

-- ─────────────────────────────────────────────
-- 4) Günlük görev: tekrarlayan gelir/gider + eski hata kayıtlarının temizliği
-- ─────────────────────────────────────────────
create or replace function public.run_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  perform public.generate_due_recurring_transactions();
  perform public.generate_due_recurring_debts();
  perform public.create_debt_due_notifications();

  for v_book_id in select id from public.books loop
    perform public.create_budget_alert_notifications(v_book_id);
  end loop;

  perform public.create_subscription_expiry_notifications();

  delete from public.app_error_events where last_seen < now() - interval '30 days';
end;
$$;
revoke all on function public.run_scheduled_notifications() from public;
grant execute on function public.run_scheduled_notifications() to service_role;

-- ─────────────────────────────────────────────
-- 5) Yardım Merkezi
-- ─────────────────────────────────────────────
insert into public.help_articles
  (category_id, slug, title, summary, body, steps, tags, related_path, related_label, context_keys, is_faq, sort_order, status)
select c.id, s.slug, s.title, s.summary, s.body, s.steps, s.tags, s.related_path, s.related_label, s.context_keys, false, s.sort_order, 'published'
from (values
  ('birikim-hedefi-nasil-olusturulur', 'butceler',
   'Birikim hedefi nasıl oluşturulur?',
   'Tatil, araba veya acil durum fonu gibi hedefler koyup ne kadar biriktirdiğini takip edebilirsin.',
   $b$Birikim hedefi; hedef tutarı, istersen bir hedef tarihi ve hedef için ayırdığın tutarlardan oluşur. Hedefe tarih verirsen Parakip, hedefe zamanında ulaşmak için ayda ne kadar ayırman gerektiğini gösterir.

"Para ekle" ile hedef için ayırdığın tutarı kaydedersin. Bu kayıt hesap bakiyeni değiştirmez; parayı gerçekten ayrı bir hesaba taşımak istersen Hareketler ekranından transfer yapabilirsin. Hedeften para kullandıysan "Para çek" ile düşebilirsin.

Hedef tutarına ulaştığında hedef otomatik olarak "Tamamlandı" olur. Artık takip etmek istemediğin hedefi arşivleyebilirsin.

Ücretsiz planda aynı anda 1 aktif hedef tutulabilir; Premium'da sınırsızdır.$b$,
   jsonb_build_array('Menüden "Hedefler"e gir.', '"Yeni hedef"e dokun, adını ve tutarını yaz.', 'İstersen hedef tarihi seç.', 'Biriktirdikçe hedefin içinden "Para ekle"ye dokun.'),
   array['hedef', 'birikim', 'tasarruf', 'goal'], '/goals', 'Hedeflere git', array['goals'], 40),
  ('tekrarlayan-gelir-gider', 'gelir-gider',
   'Maaş veya abonelik gibi düzenli kayıtları otomatik ekleme',
   'Her ay veya her hafta tekrarlayan gelir ve giderleri bir kez tanımla, Parakip vadesi gelince kaydı kendisi oluştursun.',
   $b$Hareketler ekranındaki "Tekrarlayan" bölümünden maaş, kira geliri, abonelik veya fatura gibi düzenli kayıtlar için kural oluşturabilirsin. Kural için tür (gelir/gider), tutar, hesap, isteğe bağlı kategori ve tekrar sıklığını (her ay belirli bir gün veya her hafta belirli bir gün) seçersin.

Vadesi gelen kayıt her sabah otomatik olarak eklenir ve hesap bakiyene yansır. Başlangıç günü bugünse ilk kayıt hemen oluşur. Otomatik oluşan kayıtlar normal kayıtlar gibidir; gerekirse iptal edebilirsin.

Bir kaydı ekleyemezsek (ör. hesap arşivlenmişse veya ücretsiz İşletme planında aylık işlem sınırı dolmuşsa) kuralın altında nedenini gösteririz. Kuralı istediğin zaman durdurup yeniden başlatabilirsin; yeniden başlatınca geçmiş dönemler toplu eklenmez.$b$,
   jsonb_build_array('Hareketler ekranında "Tekrarlayan"a dokun.', '"Yeni kural"a dokun.', 'Tür, tutar, hesap ve sıklığı seç.', 'Kaydet — vadesi gelince kayıt otomatik eklenir.'),
   array['tekrarlayan', 'maaş', 'abonelik', 'otomatik', 'düzenli'], '/transactions/recurring', 'Tekrarlayan kayıtlar', array['transactions'], 35)
) as s(slug, category_slug, title, summary, body, steps, tags, related_path, related_label, context_keys, sort_order)
join public.help_categories c on c.slug = s.category_slug
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────
-- 6) Admin kullanım istatistikleri (yalnızca service_role / admin paneli)
-- ─────────────────────────────────────────────
-- Mevcut verilerden hesaplanır; ayrı bir takip/çerez yoktur. "İşlem
-- yaptı" = audit_log'da kişinin oluşturduğu bir gelir/gider/transfer
-- hareketi (tekrarlayan kuralların ürettikleri de kuralı kuranın adına sayılır).
create or replace function public.admin_usage_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_result jsonb;
begin
  with cohort as (
    select u.id, u.created_at, u.email_confirmed_at, u.last_sign_in_at
      from auth.users u
     where u.created_at >= v_since
  ),
  tx_actors as (
    select actor_user_id, min(created_at) as first_tx
      from public.audit_log
     where entity_type = 'transaction_entry' and action = 'created' and actor_user_id is not null
     group by actor_user_id
  ),
  funnel as (
    select
      count(*) as signed_up,
      count(*) filter (where c.email_confirmed_at is not null) as confirmed,
      count(*) filter (where exists (select 1 from public.spaces s where s.owner_user_id = c.id)
                          or exists (select 1 from public.space_members m where m.user_id = c.id)) as has_space,
      count(*) filter (where exists (select 1 from public.accounts a join public.books b on b.id = a.book_id
                                     join public.space_members m on m.space_id = b.space_id where m.user_id = c.id)) as has_account,
      count(*) filter (where exists (select 1 from tx_actors t where t.actor_user_id = c.id)) as first_tx,
      count(*) filter (where c.last_sign_in_at > c.created_at + interval '1 day') as returned,
      count(*) filter (where public.has_home_premium(c.id)
                          or exists (select 1 from public.spaces s where s.owner_user_id = c.id and s.type = 'business'
                                     and public.has_business_subscription(s.id))) as premium
    from cohort c
  ),
  activity as (
    select
      (select count(distinct actor_user_id) from public.audit_log where created_at > now() - interval '1 day') as dau,
      (select count(distinct actor_user_id) from public.audit_log where created_at > now() - interval '7 days') as wau,
      (select count(distinct actor_user_id) from public.audit_log where created_at > now() - interval '30 days') as mau,
      (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as signed_in_7d,
      (select count(*) from auth.users where email_confirmed_at is not null) as confirmed_total
  ),
  adoption as (
    select
      (select count(*) from public.books b join public.spaces s on s.id = b.space_id where not s.is_archived) as books,
      (select count(distinct book_id) from public.transaction_entries) as with_tx,
      (select count(distinct book_id) from public.budgets) as with_budget,
      (select count(distinct book_id) from public.debts) as with_debt,
      (select count(distinct book_id) from public.recurring_payment_rules) as with_recurring_debt,
      (select count(distinct book_id) from public.recurring_transaction_rules) as with_recurring_tx,
      (select count(distinct p.book_id) from public.portfolios p join public.holdings h on h.portfolio_id = p.id) as with_investment,
      (select count(distinct book_id) from public.savings_goals) as with_goal,
      (select count(*) from (select space_id from public.space_members group by space_id having count(*) > 1) x) as shared_spaces,
      (select count(*) from public.support_tickets) as tickets
  ),
  weekly as (
    select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'signups', w.signups, 'activated', w.activated) order by w.week), '[]'::jsonb) as rows
      from (
        select to_char(date_trunc('week', u.created_at at time zone 'Europe/Istanbul'), 'YYYY-MM-DD') as week,
               count(*) as signups,
               count(*) filter (where t.first_tx is not null and t.first_tx <= u.created_at + interval '7 days') as activated
          from auth.users u
          left join tx_actors t on t.actor_user_id = u.id
         where u.created_at >= now() - interval '12 weeks'
         group by 1
      ) w
  )
  select jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'funnel', (select to_jsonb(f) from funnel f),
    'activity', (select to_jsonb(a) from activity a),
    'adoption', (select to_jsonb(d) from adoption d),
    'weekly', (select rows from weekly)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_usage_stats(integer) from public, anon, authenticated;
grant execute on function public.admin_usage_stats(integer) to service_role;

-- Abonelik makalesi: birikim hedefi farkı
update public.help_articles
   set body = replace(replace(body,
       'Ev Premium, Ev alanında sınırsız hesap ve sınırsız üye sağlar.',
       'Ev Premium, Ev alanında sınırsız hesap, sınırsız üye ve sınırsız birikim hedefi sağlar.'),
       'Ücretsiz planda her alana, sahibi dışında 1 üye davet edebilirsin (bekleyen davetler dahil).',
       'Ücretsiz planda her alana, sahibi dışında 1 üye davet edebilirsin (bekleyen davetler dahil) ve aynı anda 1 birikim hedefi tutabilirsin.')
 where slug = 'abonelik-nasil-calisir';
