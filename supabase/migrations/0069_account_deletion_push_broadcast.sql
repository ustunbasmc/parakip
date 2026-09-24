-- 0069_account_deletion_push_broadcast.sql
--
-- 1) GERÇEK hesap silme (KVKK). 0057'deki "yalnızca anonimleştir" yaklaşımı
--    yerine, bekleme süresi dolan talepler için:
--      - Kullanıcının TEK üyesi olduğu alanlar tüm kayıtlarıyla kalıcı silinir.
--      - Başka üyeleri olan alanlarda sahiplik en kıdemli yöneticiye (yoksa
--        en kıdemli üyeye) devredilir; alan ve kayıtları korunur.
--      - Diğer alanlardaki üyelikleri kaldırılır.
--      - Ardından uygulama auth kullanıcısını Admin API ile siler.
--    Ödeme kayıtları (havale talepleri) muhasebe için saklanır; kişi/alan
--    bağlantısı kaldırılır (set null).
-- 2) Anlık bildirim (web push): cihaz abonelikleri, gönderim kuyruğu
--    (notifications.push_pending) ve pg_net ile anında tetikleme.
-- 3) Admin duyuruları: admin panelinden kullanıcılara özel bildirim.

-- ───────────────────────── 1. Hesap silme ─────────────────────────

-- Silinen kullanıcı yüzünden ortak alanlardaki kayıtlar kaybolmasın /
-- silme engellenmesin: oluşturan kişi bağlantısı null'a düşer.
alter table public.recurring_payment_rules alter column created_by drop not null;
alter table public.recurring_payment_rules drop constraint recurring_payment_rules_created_by_fkey;
alter table public.recurring_payment_rules
  add constraint recurring_payment_rules_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

alter table public.recurring_transaction_rules alter column created_by drop not null;
alter table public.recurring_transaction_rules drop constraint recurring_transaction_rules_created_by_fkey;
alter table public.recurring_transaction_rules
  add constraint recurring_transaction_rules_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

-- Havale talepleri = ödeme kaydı; kullanıcı/alan silinse de kayıt kalır.
alter table public.manual_payment_requests alter column user_id drop not null;
alter table public.manual_payment_requests alter column space_id drop not null;
alter table public.manual_payment_requests drop constraint manual_payment_requests_user_id_fkey;
alter table public.manual_payment_requests
  add constraint manual_payment_requests_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.manual_payment_requests drop constraint manual_payment_requests_space_id_fkey;
alter table public.manual_payment_requests
  add constraint manual_payment_requests_space_id_fkey foreign key (space_id) references public.spaces (id) on delete set null;

-- Tamamlanan silmelerin kişisel veri içermeyen kaydı (admin istatistiği).
create table if not exists public.account_deletions (
  user_id uuid primary key,
  requested_at timestamptz,
  prepared_at timestamptz not null default now(),
  completed_at timestamptz,
  spaces_deleted int not null default 0,
  spaces_transferred int not null default 0,
  memberships_removed int not null default 0
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from anon, authenticated;

-- Bir alanı TÜM kayıtlarıyla kalıcı siler. Yalnızca silme akışı içinden
-- çağrılır (service_role); istemciye açık DEĞİLDİR.
create or replace function public.purge_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  for b in select id from public.books where space_id = p_space_id loop
    -- Başka bir deftere de dokunan işlem varsa (olmamalı) silme durur.
    if exists (
      select 1 from public.transaction_entries e
      join public.transaction_entries o on o.transaction_id = e.transaction_id
      where e.book_id = b.id and o.book_id <> b.id
    ) then
      raise exception 'purge_space: defterler arası işlem bulundu (book=%)', b.id;
    end if;

    delete from public.debt_payments
      where debt_id in (select id from public.debts where book_id = b.id)
         or transaction_entry_id in (select id from public.transaction_entries where book_id = b.id);
    delete from public.holding_transactions
      where holding_id in (select h.id from public.holdings h join public.portfolios p on p.id = h.portfolio_id where p.book_id = b.id);
    delete from public.holdings where portfolio_id in (select id from public.portfolios where book_id = b.id);
    delete from public.portfolios where book_id = b.id;
    delete from public.budgets where book_id = b.id;
    delete from public.savings_goals where book_id = b.id;
    delete from public.recurring_transaction_rules where book_id = b.id;
    delete from public.recurring_payment_rules where book_id = b.id;
    delete from public.transactions where id in (select transaction_id from public.transaction_entries where book_id = b.id);
    delete from public.transaction_entries where book_id = b.id;
    delete from public.debts where book_id = b.id;
    delete from public.audit_log where book_id = b.id;
    delete from public.categories where book_id = b.id and parent_id is not null;
    delete from public.categories where book_id = b.id;
    delete from public.books where id = b.id;
  end loop;
  delete from public.spaces where id = p_space_id;
end;
$$;
revoke all on function public.purge_space(uuid) from public, anon, authenticated;

-- Sahiplik devri için aday: en kıdemli yönetici, yoksa en kıdemli üye.
create or replace function public.deletion_successor(p_space_id uuid, p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id from public.space_members m
  where m.space_id = p_space_id and m.user_id <> p_user_id
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'editor' then 2 else 3 end,
           coalesce(m.accepted_at, m.invited_at, m.created_at)
  limit 1;
$$;
revoke all on function public.deletion_successor(uuid, uuid) from public, anon, authenticated;

-- Silme talebi öncesi kullanıcıya ne olacağını gösterir (yalnızca kendisi).
create or replace function public.preview_account_deletion()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'deleted', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'type', s.type) order by s.created_at)
      from public.spaces s
      where s.owner_user_id = auth.uid() and public.deletion_successor(s.id, auth.uid()) is null
    ), '[]'::jsonb),
    'transferred', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'type', s.type,
        'to', coalesce(nullif(p.display_name, ''), 'bir üye')
      ) order by s.created_at)
      from public.spaces s
      left join public.profiles p on p.user_id = public.deletion_successor(s.id, auth.uid())
      where s.owner_user_id = auth.uid() and public.deletion_successor(s.id, auth.uid()) is not null
    ), '[]'::jsonb),
    'left', (
      select count(*) from public.space_members m join public.spaces s on s.id = m.space_id
      where m.user_id = auth.uid() and s.owner_user_id <> auth.uid()
    )
  )
  where auth.uid() is not null;
$$;
revoke all on function public.preview_account_deletion() from public, anon;
grant execute on function public.preview_account_deletion() to authenticated;

-- Silmenin veritabanı kısmı (auth kullanıcısı hariç). Tekrar çalıştırılabilir:
-- auth silme başarısız olursa ertesi gün yeniden denenir.
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_next uuid;
  v_deleted int := 0;
  v_transferred int := 0;
  v_left int := 0;
  v_requested timestamptz;
begin
  select deletion_requested_at into v_requested from public.profiles where user_id = p_user_id;

  for s in select id, name from public.spaces where owner_user_id = p_user_id loop
    v_next := public.deletion_successor(s.id, p_user_id);
    if v_next is null then
      perform public.purge_space(s.id);
      v_deleted := v_deleted + 1;
    else
      update public.spaces set owner_user_id = v_next where id = s.id;
      update public.space_members set role = 'owner' where space_id = s.id and user_id = v_next;
      update public.subscriptions set owner_user_id = v_next where space_id = s.id and owner_user_id = p_user_id;
      perform public.create_notification(
        v_next, 'ownership_transferred',
        '"' || s.name || '" alanının sahibi artık sensin',
        'Önceki sahip hesabını sildiği için alanın sahipliği sana devredildi. Kayıtların aynen duruyor.',
        'space', s.id, s.id
      );
      v_transferred := v_transferred + 1;
    end if;
  end loop;

  delete from public.space_members where user_id = p_user_id;
  get diagnostics v_left = row_count;

  delete from public.notifications where user_id = p_user_id;
  update public.app_error_events set last_user_id = null where last_user_id = p_user_id;

  insert into public.account_deletions (user_id, requested_at, spaces_deleted, spaces_transferred, memberships_removed)
  values (p_user_id, v_requested, v_deleted, v_transferred, v_left)
  on conflict (user_id) do update set
    prepared_at = now(),
    spaces_deleted = public.account_deletions.spaces_deleted + excluded.spaces_deleted,
    spaces_transferred = public.account_deletions.spaces_transferred + excluded.spaces_transferred,
    memberships_removed = public.account_deletions.memberships_removed + excluded.memberships_removed;

  return jsonb_build_object('deleted', v_deleted, 'transferred', v_transferred, 'left', v_left);
end;
$$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;

-- ───────────────────────── 2. Anlık bildirim ─────────────────────────

create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  hide_details boolean not null default false,
  user_agent text,
  failure_count int not null default 0,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text, p_hide_details boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 2000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Geçersiz abonelik.';
  end if;
  -- Aynı tarayıcıda başka bir hesaba geçildiyse abonelik yeni hesaba taşınır.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, hide_details)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), coalesce(p_hide_details, false))
  on conflict (endpoint) do update set
    user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, hide_details = excluded.hide_details, failure_count = 0;
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text, boolean) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, boolean) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- Gönderim hatası sayacı (20 ardışık hatadan sonra cihaz atlanır).
create or replace function public.increment_push_failure(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions set failure_count = failure_count + 1 where id = p_id;
$$;
revoke all on function public.increment_push_failure(uuid) from public, anon, authenticated;
grant execute on function public.increment_push_failure(uuid) to service_role;

-- Kuyruk: bildirim oluşurken kullanıcının kayıtlı cihazı varsa push_pending.
alter table public.notifications add column if not exists push_pending boolean not null default false;
alter table public.notifications add column if not exists push_sent_at timestamptz;
alter table public.notifications add column if not exists link text;
create index if not exists notifications_push_pending_idx on public.notifications (created_at) where push_pending;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'debt_due', 'budget_80', 'budget_exceeded', 'transfer_created', 'space_invite', 'support_reply',
  'subscription_expiring', 'monthly_summary', 'admin_message', 'ownership_transferred'
));

create or replace function public.notifications_mark_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.push_pending := exists (select 1 from public.push_subscriptions where user_id = new.user_id);
  return new;
end;
$$;
drop trigger if exists notifications_mark_push on public.notifications;
create trigger notifications_mark_push before insert on public.notifications
  for each row execute function public.notifications_mark_push();

-- Gönderim adresi ve paylaşılan anahtar (yalnızca veritabanında üretilir,
-- depoda yer almaz). İstemci rollerine kapalıdır.
create table if not exists public.app_runtime_config (
  key text primary key,
  value text not null
);
alter table public.app_runtime_config enable row level security;
revoke all on public.app_runtime_config from anon, authenticated;
insert into public.app_runtime_config (key, value) values
  ('push_dispatch_url', 'https://www.parakip.com/api/push/dispatch'),
  ('push_dispatch_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create or replace function public.get_push_dispatch_token()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select value from public.app_runtime_config where key = 'push_dispatch_token';
$$;
revoke all on function public.get_push_dispatch_token() from public, anon, authenticated;
grant execute on function public.get_push_dispatch_token() to service_role;

-- Bekleyen push varsa uygulamanın gönderim ucunu çağırır. Hata olursa
-- bildirimin kendisini ASLA engellemez (10 dakikalık cron yeniden dener).
create or replace function public.request_push_dispatch()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_token text;
begin
  if not exists (select 1 from public.notifications where push_pending and created_at > now() - interval '1 day') then
    return;
  end if;
  select value into v_url from public.app_runtime_config where key = 'push_dispatch_url';
  select value into v_token from public.app_runtime_config where key = 'push_dispatch_token';
  if v_url is null or v_token is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-token', v_token),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'request_push_dispatch: %', sqlerrm;
end;
$$;
revoke all on function public.request_push_dispatch() from public, anon, authenticated;

create or replace function public.notifications_after_insert_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from new_rows where push_pending) then
    perform public.request_push_dispatch();
  end if;
  return null;
end;
$$;
drop trigger if exists notifications_after_insert_push on public.notifications;
create trigger notifications_after_insert_push after insert on public.notifications
  referencing new table as new_rows
  for each statement execute function public.notifications_after_insert_push();

-- Gönderim ucu bekleyenleri atomik olarak sahiplenir (aynı bildirim iki kez gitmez).
create or replace function public.claim_push_notifications(p_limit int default 100)
returns table (id uuid, user_id uuid, type text, title text, body text, entity_type text, entity_id uuid, space_id uuid, link text)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1 günden eski bekleyenler artık gönderilmez.
  update public.notifications n set push_pending = false
  where n.push_pending and n.created_at <= now() - interval '1 day';

  return query
  update public.notifications n set push_pending = false, push_sent_at = now()
  where n.id in (
    select x.id from public.notifications x
    where x.push_pending
    order by x.created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  returning n.id, n.user_id, n.type, n.title, n.body, n.entity_type, n.entity_id, n.space_id, n.link;
end;
$$;
revoke all on function public.claim_push_notifications(int) from public, anon, authenticated;
grant execute on function public.claim_push_notifications(int) to service_role;

-- Anında tetikleme kaçarsa (ağ hatası vb.) 10 dakikada bir yeniden dene.
select cron.schedule('push-dispatch-retry', '*/10 * * * *', $cron$select public.request_push_dispatch()$cron$);

-- ───────────────────────── 3. Admin duyuruları ─────────────────────────

create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  audience text not null,
  title text not null,
  body text,
  link text,
  recipient_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.admin_broadcasts enable row level security;
revoke all on public.admin_broadcasts from anon, authenticated;

-- Tercihlerden bağımsızdır (duyurular kapatılamaz); yalnızca service_role.
create or replace function public.admin_send_broadcast(
  p_admin_user_id uuid, p_audience text, p_user_ids uuid[], p_title text, p_body text, p_link text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if coalesce(length(trim(p_title)), 0) = 0 or length(p_title) > 120 or length(coalesce(p_body, '')) > 1000 then
    raise exception 'Başlık 1-120, mesaj en fazla 1000 karakter olmalı.';
  end if;
  if p_link is not null and (p_link !~ '^/' or p_link ~ '^//') then
    raise exception 'Bağlantı uygulama içi bir yol olmalı (/ ile başlar).';
  end if;

  insert into public.admin_broadcasts (admin_user_id, audience, title, body, link)
  values (p_admin_user_id, p_audience, trim(p_title), nullif(trim(p_body), ''), p_link)
  returning id into v_id;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, link)
  select distinct u.id, 'admin_message', trim(p_title), nullif(trim(p_body), ''), 'admin_broadcast', v_id, p_link
  from unnest(p_user_ids) as u(id)
  join auth.users au on au.id = u.id;
  get diagnostics v_count = row_count;

  update public.admin_broadcasts set recipient_count = v_count where id = v_id;
  return jsonb_build_object('id', v_id, 'count', v_count);
end;
$$;
revoke all on function public.admin_send_broadcast(uuid, text, uuid[], text, text, text) from public, anon, authenticated;
grant execute on function public.admin_send_broadcast(uuid, text, uuid[], text, text, text) to service_role;

-- ───────────────────────── Yardım makalesi ─────────────────────────

update public.help_articles set
  summary = 'Hesap yönetimi ekranından silme talebi oluşturabilirsin; 7 günlük bekleme süresinden sonra hesabın ve verilerin kalıcı olarak silinir.',
  body = $b$Silme talebi oluşturduğunda hiçbir şey hemen silinmez. 7 gün boyunca uygulamayı kullanmaya devam edebilir, istersen talebi iptal edebilirsin.

Bekleme süresi dolunca:
- Tek başına kullandığın alanlar (hesaplar, gelir-giderler, borçlar, bütçeler, hedefler, yatırımlar) kalıcı olarak silinir.
- Başka üyelerin de olduğu ortak alanlar silinmez; sahipliği o alandaki en kıdemli yöneticiye (yoksa en kıdemli üyeye) devredilir.
- Hesabın, profil bilgilerin ve bildirimlerin silinir. Bu işlem geri alınamaz.

Ödeme kayıtları yasal yükümlülükler nedeniyle kişisel bağlantısı kaldırılarak saklanır.

Silmeden önce "Verilerimi indir" ile tüm kayıtlarını tek bir dosya olarak indirebilirsin.$b$,
  steps = jsonb_build_array(
    'Profil menüsünden "Hesap yönetimi"ne gir.',
    'İstersen önce "Verilerimi indir" ile kayıtlarını indir.',
    'Hesap silme talebini başlat; hangi alanların silineceğini ve kime devredileceğini gör.',
    'Güvenlik için şifreni tekrar gir ve onayla.',
    'Vazgeçersen 7 gün içinde aynı ekrandan "Talebi iptal et"e dokun.')
where slug = 'hesabimi-nasil-silebilirim';
