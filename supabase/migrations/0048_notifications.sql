-- 0048_notifications.sql
-- Amaç: Temel uygulama içi bildirim altyapısı. SAF EKLEME — hiçbir
-- mevcut tablo/fonksiyon/politika/kısıt DEĞİŞTİRİLMEDİ. `create_transfer`,
-- `create_simple_transaction`, `update_debt`, bütçe fonksiyonları vb.
-- BİREBİR AYNI KALDI (dokunulmadı) — "transfer oluşturuldu" bildirimi
-- create_transfer'ın GÖVDESİNİ değiştirmek yerine, transactions tablosu
-- üzerinde AYRI bir trigger ile üretiliyor (aşağıda açıklanıyor).

-- ─────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('debt_due', 'budget_80', 'budget_exceeded', 'transfer_created', 'space_invite')),
  title text not null,
  body text,
  -- entity_type/entity_id: audit_log (0009) ile AYNI desen — kasıtlı
  -- olarak polymorphic, FK YOK (ileride yeni entity_type'lar eklenebilsin).
  entity_type text,
  entity_id uuid,
  space_id uuid references public.spaces (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Uygulama içi bildirimler. Yazma yolu YALNIZCA SECURITY DEFINER '
  'fonksiyonlardır (create_notification ve onu çağıran trigger/RPC''ler) — '
  'istemciden doğrudan INSERT/UPDATE/DELETE için HİÇBİR RLS politikası '
  'tanımlı DEĞİLDİR (RLS''de politika yoksa o işlem tamamen reddedilir).';

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- notification_preferences
-- ─────────────────────────────────────────────
create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Dört kategori — "borç vadesi, bütçe uyarısı, transfer, alan daveti"
  -- (talep metnindeki dört kategoriyle birebir eşleşir). budget_alert
  -- hem %80 hem aşım eşiğini KAPSAR (ikisi ayrı switch değil — kullanıcı
  -- deneyimi için tek bir "bütçe uyarıları" anahtarı yeterli, tip bazında
  -- ayrım notifications.type üzerinden zaten korunuyor).
  debt_due boolean not null default true,
  budget_alert boolean not null default true,
  transfer_created boolean not null default true,
  space_invite boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Kullanıcı başına bildirim tercihleri. notifications''ın aksine, bunlar '
  'finansal olarak hassas veri OLMADIĞI için (profiles.theme_preference ile '
  'aynı gerekçeyle) doğrudan RLS-korumalı UPDATE''e izin verilir — SECURITY '
  'DEFINER fonksiyon gerektirmez.';

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select using (user_id = auth.uid());
create policy notification_preferences_insert_own on public.notification_preferences
  for insert with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from authenticated;
grant select on public.notifications to authenticated;
revoke all on public.notification_preferences from authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

-- ─────────────────────────────────────────────
-- create_notification — DAHİLİ yardımcı. İstemciye (authenticated) HİÇ
-- GRANT EDİLMEZ — yalnızca aşağıdaki gibi başka SECURITY DEFINER
-- fonksiyonlar/trigger'lar tarafından çağrılabilir. Kullanıcının
-- notification_preferences'ında ilgili tür kapalıysa SESSİZCE hiçbir
-- şey oluşturmaz (bildirim spam'i kullanıcı tercihine saygılı önlenir).
-- ─────────────────────────────────────────────
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_space_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_enabled boolean;
begin
  select case p_type
    when 'debt_due' then coalesce((select debt_due from public.notification_preferences where user_id = p_user_id), true)
    when 'budget_80' then coalesce((select budget_alert from public.notification_preferences where user_id = p_user_id), true)
    when 'budget_exceeded' then coalesce((select budget_alert from public.notification_preferences where user_id = p_user_id), true)
    when 'transfer_created' then coalesce((select transfer_created from public.notification_preferences where user_id = p_user_id), true)
    when 'space_invite' then coalesce((select space_invite from public.notification_preferences where user_id = p_user_id), true)
    else true
  end into v_enabled;

  if not v_enabled then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, space_id)
  values (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_space_id)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_notification is
  'DAHİLİ yardımcı — istemciye (authenticated) GRANT EDİLMEZ. Yalnızca '
  'aynı sahibe ait diğer SECURITY DEFINER fonksiyon/trigger''lar '
  'çağırabilir (Postgres''te, bir SECURITY DEFINER fonksiyon içinden yapılan '
  'iç çağrılar, çağıranın DEĞİL fonksiyon SAHİBİNİN yetkisiyle çalışır).';

revoke all on function public.create_notification(uuid, text, text, text, text, uuid, uuid) from public;

-- ─────────────────────────────────────────────
-- mark_notification_read / mark_all_notifications_read — istemcinin
-- ÇAĞIRABİLECEĞİ TEK yazma yolları (financial-rpc.ts benzeri wrapper
-- disipliniyle, ayrı bir notifications-rpc.ts dosyasından çağrılacak).
-- ─────────────────────────────────────────────
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and user_id = auth.uid() -- başka kullanıcının bildirimi ASLA işaretlenemez
    and read_at is null;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ─────────────────────────────────────────────
-- notify_transfer_created — GERÇEK ZAMANLI, otomatik çalışan TEK tür.
--
-- ÖNEMLİ: create_transfer() fonksiyonunun GÖVDESİ hiç değiştirilmedi.
-- Bunun yerine public.transactions tablosunda type='transfer' olan yeni
-- satırlarda çalışan AYRI bir trigger kullanılıyor.
--
-- DEFERRABLE INITIALLY DEFERRED olmak ZORUNDADIR: create_transfer() önce
-- transactions'a, SONRA transaction_entries'e yazar (bkz. migration 0010).
-- Sıradan bir AFTER INSERT trigger, entries henüz yokken çalışırdı ve
-- kaynak/hedef hesap bilgisini bulamazdı. DEFERRED bir trigger ise
-- transaction COMMIT olmadan hemen önce (yani entries de yazıldıktan
-- sonra) çalışır — tam istediğimiz an.
-- ─────────────────────────────────────────────
create or replace function public.notify_transfer_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from_account text;
  v_to_account text;
  v_from_book_id uuid;
  v_from_space_id uuid;
begin
  if v_actor is null then
    return new; -- auth.uid() olmayan (ör. servis) bağlamlarda bildirim üretilmez
  end if;

  select a.name, te.book_id into v_from_account, v_from_book_id
  from public.transaction_entries te
  join public.accounts a on a.id = te.account_id
  where te.transaction_id = new.id and te.amount_cents < 0
  limit 1;

  select a.name into v_to_account
  from public.transaction_entries te
  join public.accounts a on a.id = te.account_id
  where te.transaction_id = new.id and te.amount_cents > 0
  limit 1;

  select space_id into v_from_space_id from public.books where id = v_from_book_id;

  perform public.create_notification(
    v_actor,
    'transfer_created',
    'Transfer oluşturuldu',
    coalesce(v_from_account, 'Hesap') || ' → ' || coalesce(v_to_account, 'Hesap'),
    'transaction_entry',
    new.id,
    v_from_space_id
  );

  return new;
end;
$$;

create constraint trigger transactions_notify_transfer_created
  after insert on public.transactions
  deferrable initially deferred
  for each row
  when (new.type = 'transfer')
  execute function public.notify_transfer_created();

comment on function public.notify_transfer_created is
  'create_transfer() BAŞARIYLA tamamlandığında (aynı veritabanı işleminin '
  'SONUNDA, entries yazıldıktan sonra) işlemi yapan kullanıcıya otomatik '
  '"Transfer oluşturuldu" bildirimi üretir. create_transfer''ın kendisi '
  'HİÇ DEĞİŞMEDİ.';

-- ─────────────────────────────────────────────
-- ZAMANLANMIŞ GÖREV GEREKTİREN TÜRLER — bu migration bunları
-- ÇAĞRILABİLİR HALE GETİRİR ama HENÜZ HİÇBİR ŞEYİ OTOMATİK TETİKLEMEZ.
-- Gerçek otomasyon için (ör. Supabase pg_cron ile günde bir kez, veya
-- harici bir zamanlayıcı/Edge Function ile) bu fonksiyonların service_role
-- ile düzenli çağrılması GEREKİR — bu turun kapsamı DIŞINDADIR, bkz. proje
-- raporu. Sahte/otomatik oluşmuş gibi göstermemek için: bu fonksiyonlar
-- hiçbir trigger'a bağlı DEĞİLDİR, yalnızca `select` ile MANUEL çağrılabilir.
-- ─────────────────────────────────────────────

-- Borç vadesi yaklaşan/geçen (bugünden itibaren 3 gün içinde veya zaten
-- geçmiş, hâlâ açık) borç/alacaklar için ilgili kullanıcılara bildirim
-- üretir. Yalnızca service_role çalıştırabilir.
create or replace function public.create_debt_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_member record;
  v_notif_id uuid;
begin
  for v_row in
    select d.id, d.counterparty_name, d.due_date, d.direction, d.book_id, b.space_id,
      (d.due_date < current_date) as is_overdue
    from public.debts d
    join public.books b on b.id = d.book_id
    where d.status in ('open', 'partial')
      and d.due_date is not null
      and d.due_date <= current_date + interval '3 days'
  loop
    for v_member in
      select user_id from public.space_members where space_id = v_row.space_id
    loop
      select public.create_notification(
        v_member.user_id,
        'debt_due',
        case when v_row.is_overdue then 'Vadesi geçmiş ödeme' else 'Yaklaşan vade' end,
        v_row.counterparty_name || ' — ' || to_char(v_row.due_date, 'DD.MM.YYYY'),
        'debt', v_row.id, v_row.space_id
      ) into v_notif_id;
      if v_notif_id is not null then v_count := v_count + 1; end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

comment on function public.create_debt_due_notifications is
  'ZAMANLANMIŞ GÖREV GEREKTİRİR — hiçbir trigger''a bağlı değildir, otomatik '
  'çalışmaz. Günde bir kez (ör. pg_cron veya harici cron ile) service_role '
  'tarafından çağrılması tasarlanmıştır. Bu turda ZAMANLAMA KURULMADI.';

revoke all on function public.create_debt_due_notifications() from public;
grant execute on function public.create_debt_due_notifications() to service_role;

-- Bir deftere ait tüm bütçeleri tarayıp %80/aşım eşiğini geçenler için
-- bildirim üretir. Yalnızca service_role çalıştırabilir.
create or replace function public.create_budget_alert_notifications(p_book_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
  v_member record;
  v_notif_id uuid;
  v_space_id uuid;
begin
  select space_id into v_space_id from public.books where id = p_book_id;

  for v_row in
    select * from public.budget_usage where book_id = p_book_id and percent_used >= 80
  loop
    for v_member in
      select user_id from public.space_members where space_id = v_space_id
    loop
      select public.create_notification(
        v_member.user_id,
        case when v_row.percent_used >= 100 then 'budget_exceeded' else 'budget_80' end,
        case when v_row.percent_used >= 100 then 'Bütçe aşıldı' else 'Bütçe %80 seviyesinde' end,
        round(v_row.percent_used)::text || '% kullanıldı',
        'budget', v_row.budget_id, v_space_id
      ) into v_notif_id;
      if v_notif_id is not null then v_count := v_count + 1; end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

comment on function public.create_budget_alert_notifications is
  'ZAMANLANMIŞ GÖREV GEREKTİRİR (veya ileride create_simple_transaction''a '
  'dokunmadan bir transaction_entries trigger''ı ile event-driven hale '
  'getirilebilir) — bu turda hiçbir trigger''a bağlı değildir, otomatik '
  'çalışmaz. Bu turda ZAMANLAMA KURULMADI.';

revoke all on function public.create_budget_alert_notifications(uuid) from public;
grant execute on function public.create_budget_alert_notifications(uuid) to service_role;
