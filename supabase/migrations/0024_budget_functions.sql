-- 0024_budget_functions.sql
-- Amaç: budgets üzerindeki TÜM yazma işlemlerini atomik, yetki kontrollü
-- ve audit_log'a yazan fonksiyonlar üzerinden yapmak (debts modülüyle
-- aynı desen).

-- ─────────────────────────────────────────────
-- create_budget
-- ─────────────────────────────────────────────

create or replace function public.create_budget(
  p_book_id uuid,
  p_amount_cents bigint,
  p_period_month date,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget_id uuid;
  v_normalized_month date;
  v_category_book_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_cents pozitif olmalidir';
  end if;

  if p_period_month is null then
    raise exception 'period_month bos olamaz';
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  v_normalized_month := date_trunc('month', p_period_month)::date;

  if p_category_id is not null then
    select book_id into v_category_book_id
    from public.categories
    where id = p_category_id;

    if not found then
      raise exception 'Kategori bulunamadi (id=%)', p_category_id;
    end if;

    if v_category_book_id is not null and v_category_book_id <> p_book_id then
      raise exception 'Bu kategori baska bir deftere ait, bu defterde kullanilamaz';
    end if;
  end if;

  -- Erken, anlamlı hata mesajı icin duplicate kontrolu (gercek guvenlik
  -- agi budgets_category_unique / budgets_total_unique kisitlaridir).
  if p_category_id is null then
    if exists (
      select 1 from public.budgets
      where book_id = p_book_id and period_month = v_normalized_month
        and category_id is null and status = 'active'
    ) then
      raise exception 'Bu ay icin zaten aktif bir toplam butce var (book_id=%, ay=%)', p_book_id, v_normalized_month;
    end if;
  else
    if exists (
      select 1 from public.budgets
      where book_id = p_book_id and period_month = v_normalized_month
        and category_id = p_category_id and status = 'active'
    ) then
      raise exception 'Bu kategori ve ay icin zaten aktif bir butce var (category_id=%, ay=%)', p_category_id, v_normalized_month;
    end if;
  end if;

  insert into public.budgets (book_id, category_id, period_month, amount_cents)
  values (p_book_id, p_category_id, v_normalized_month, p_amount_cents)
  returning id into v_budget_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (
    p_book_id, auth.uid(), 'created', 'budget', v_budget_id,
    jsonb_build_object(
      'category_id', p_category_id, 'period_month', v_normalized_month, 'amount_cents', p_amount_cents
    )
  );

  return v_budget_id;
end;
$$;

comment on function public.create_budget is
  'Aylık toplam (category_id=NULL) veya kategori bazlı bütçe oluşturur. '
  'Aynı book+kategori+ay için çakışan aktif bütçe reddedilir. Kategori '
  'verilirse, o kategori ya global ya da AYNI book''a ait olmalıdır.';

revoke all on function public.create_budget(uuid, bigint, date, uuid) from public;
grant execute on function public.create_budget(uuid, bigint, date, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- update_budget — jsonb tabanlı güvenli partial update (debts modülüyle
-- tutarlı: E10 sınıfı sessiz-dönüşüm riskini baştan önlemek için).
-- Yalnızca amount_cents değiştirilebilir; kapsamı (book/kategori/ay)
-- değiştirmek için iptal edip yeni bütçe oluşturulmalıdır.
-- ─────────────────────────────────────────────

create or replace function public.update_budget(
  p_budget_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
  v_old_amount bigint;
  v_new_amount bigint;
  v_allowed_keys text[] := array['amount_cents'];
  v_key text;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception
      'p_updates bir JSON nesnesi olmalidir, ornek: {"amount_cents": 50000}. Alinan tip: %',
      coalesce(jsonb_typeof(p_updates), 'null');
  end if;

  for v_key in select jsonb_object_keys(p_updates)
  loop
    if not (v_key = any (v_allowed_keys)) then
      raise exception
        'update_budget: bilinmeyen alan "%": yalnizca su alanlar guncellenebilir: %',
        v_key, array_to_string(v_allowed_keys, ', ');
    end if;
  end loop;

  select book_id, status, amount_cents
    into v_book_id, v_status, v_old_amount
  from public.budgets
  where id = p_budget_id;

  if v_book_id is null then
    raise exception 'Butce bulunamadi (id=%)', p_budget_id;
  end if;

  if v_status = 'cancelled' then
    raise exception 'Iptal edilmis bir butce guncellenemez';
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  v_new_amount := v_old_amount;

  if p_updates ? 'amount_cents' then
    if jsonb_typeof(p_updates -> 'amount_cents') <> 'number' then
      raise exception
        'amount_cents bir sayi olmalidir, alinan tip: %', jsonb_typeof(p_updates -> 'amount_cents');
    end if;
    v_new_amount := (p_updates ->> 'amount_cents')::bigint;
    if v_new_amount <= 0 then
      raise exception 'amount_cents pozitif olmalidir';
    end if;
  end if;

  update public.budgets
  set amount_cents = v_new_amount
  where id = p_budget_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'updated', 'budget', p_budget_id,
    jsonb_build_object('amount_cents', v_old_amount), jsonb_build_object('amount_cents', v_new_amount)
  );
end;
$$;

comment on function public.update_budget is
  'GÜVENLİ PARTIAL UPDATE: yalnızca amount_cents değiştirilebilir. '
  'p_updates bir JSON nesnesidir; bilinmeyen anahtar veya yanlış tip '
  'sessizce yok sayılmaz, açık hata döner.';

revoke all on function public.update_budget(uuid, jsonb) from public;
grant execute on function public.update_budget(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────
-- cancel_budget
-- ─────────────────────────────────────────────

create or replace function public.cancel_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_status text;
begin
  select book_id, status into v_book_id, v_status
  from public.budgets
  where id = p_budget_id;

  if v_book_id is null then
    raise exception 'Butce bulunamadi (id=%)', p_budget_id;
  end if;

  if not public.has_book_role(v_book_id, array['owner', 'admin']) then
    raise exception 'Bu islem icin yetkiniz yok (owner/admin gerekli)';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Bu butce zaten iptal edilmis';
  end if;

  update public.budgets
  set status = 'cancelled'
  where id = p_budget_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (
    v_book_id, auth.uid(), 'cancelled', 'budget', p_budget_id,
    jsonb_build_object('status', v_status), jsonb_build_object('status', 'cancelled')
  );
end;
$$;

comment on function public.cancel_budget is
  'Bir bütçeyi iptal eder. Yalnızca owner/admin çağırabilir.';

revoke all on function public.cancel_budget(uuid) from public;
grant execute on function public.cancel_budget(uuid) to authenticated;
