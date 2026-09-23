-- 0065_space_invitations_and_reminders.sql
-- Amaç:
--   1) Alanlara üye davet etme (space_invitations + kontrollü RPC'ler).
--   2) space_members GÜVENLİK SIKILAŞTIRMASI: owner/admin'in tabloya
--      DOĞRUDAN insert/update/delete izni kaldırılır. Aksi halde bir admin
--      kendini 'owner' yapabilir veya sahibin rolünü düşürebilirdi. Üyelik
--      değişiklikleri artık yalnızca aşağıdaki RPC'lerle yapılır.
--   3) Abonelik bitiş hatırlatması (bildirim türü 'subscription_expiring').
--   4) HATA DÜZELTMESİ: generate_due_recurring_debts() (0050) hiçbir
--      zamanlayıcıya bağlı değildi — tekrarlayan kurallar hiç borç
--      üretmiyordu. Artık run_scheduled_notifications() içinden çağrılır.
--
-- Finansal tablolar (transactions, entries, accounts, budgets…) ve
-- onların RLS'i DEĞİŞTİRİLMEZ. Yeni üyenin neyi görüp yapabileceği mevcut
-- rol bazlı RLS'e (has_space_role/has_book_role) göre belirlenir.

-- ─────────────────────────────────────────────
-- 1) space_invitations
-- ─────────────────────────────────────────────
create table if not exists public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role text not null check (role in ('admin', 'editor', 'viewer')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

comment on table public.space_invitations is
  'Alan üyelik davetleri. Davet bağlantısı (token) ile açılır; yalnızca davet '
  'edilen e-posta adresine sahip hesap kabul edebilir. Yazma yalnızca SECURITY '
  'DEFINER RPC''lerle yapılır.';

-- Aynı alana aynı e-postaya tek bekleyen davet.
create unique index if not exists space_invitations_one_pending
  on public.space_invitations (space_id, email) where status = 'pending';
create index if not exists space_invitations_email_idx on public.space_invitations (email) where status = 'pending';

alter table public.space_invitations enable row level security;

drop policy if exists space_invitations_select_manager on public.space_invitations;
create policy space_invitations_select_manager
  on public.space_invitations for select
  using (public.has_space_role(space_id, array['owner', 'admin']));

revoke all on public.space_invitations from anon, authenticated;
grant select on public.space_invitations to authenticated;

-- ─────────────────────────────────────────────
-- 2) space_members sıkılaştırma
-- ─────────────────────────────────────────────
drop policy if exists space_members_insert_owner_admin on public.space_members;
drop policy if exists space_members_update_owner_admin on public.space_members;
drop policy if exists space_members_delete_owner_admin on public.space_members;
revoke insert, update, delete on public.space_members from authenticated;

-- Yardımcı: çağıranın bu alandaki rolü (yoksa null).
create or replace function public.my_space_role(p_space_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.space_members where space_id = p_space_id and user_id = auth.uid();
$$;
revoke all on function public.my_space_role(uuid) from public, anon;
grant execute on function public.my_space_role(uuid) to authenticated;

-- Yardımcı: üyelik değişikliğini defterin audit_log'una yazar.
create or replace function public.log_space_member_event(p_space_id uuid, p_event text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  select id into v_book_id from public.books where space_id = p_space_id limit 1;
  if v_book_id is null then
    return;
  end if;
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_book_id, auth.uid(), 'updated', 'space', p_space_id, jsonb_build_object('event', p_event) || coalesce(p_detail, '{}'::jsonb));
end;
$$;
revoke all on function public.log_space_member_event(uuid, text, jsonb) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- create_space_invitation
-- ─────────────────────────────────────────────
create or replace function public.create_space_invitation(p_space_id uuid, p_email text, p_role text)
returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_my_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_space record;
  v_target uuid;
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_inviter text;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Geçerli bir e-posta adresi gir.' using errcode = '22023';
  end if;
  if p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'Geçersiz rol.' using errcode = '22023';
  end if;

  select id, name, is_archived into v_space from public.spaces where id = p_space_id;
  if not found then
    raise exception 'Alan bulunamadı.' using errcode = 'P0002';
  end if;
  if v_space.is_archived then
    raise exception 'Arşivlenmiş alana davet gönderilemez.' using errcode = '22023';
  end if;

  v_my_role := public.my_space_role(p_space_id);
  if v_my_role is null or v_my_role not in ('owner', 'admin') then
    raise exception 'Bu alana davet göndermek için yetkin yok.' using errcode = '42501';
  end if;
  if v_my_role = 'admin' and p_role = 'admin' then
    raise exception 'Yönetici davet etmeyi yalnızca alan sahibi yapabilir.' using errcode = '42501';
  end if;

  select id into v_target from auth.users where lower(email) = v_email limit 1;
  if v_target is not null and exists (select 1 from public.space_members where space_id = p_space_id and user_id = v_target) then
    raise exception 'Bu kişi zaten alanın üyesi.' using errcode = '23505';
  end if;

  -- Aynı e-postaya bekleyen eski davet varsa geri çekilir (yeniden gönderim).
  update public.space_invitations
     set status = 'revoked', responded_at = now()
   where space_id = p_space_id and email = v_email and status = 'pending';

  insert into public.space_invitations (space_id, email, role, token, invited_by)
  values (p_space_id, v_email, p_role, v_token, v_uid)
  returning id into v_id;

  perform public.log_space_member_event(p_space_id, 'invitation_created', jsonb_build_object('email', v_email, 'role', p_role));

  -- Davet edilen kişinin hesabı varsa uygulama içi bildirim.
  if v_target is not null then
    select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), display_name, 'Bir kullanıcı')
      into v_inviter from public.profiles where user_id = v_uid;
    perform public.create_notification(
      v_target, 'space_invite',
      coalesce(v_inviter, 'Bir kullanıcı') || ' seni "' || v_space.name || '" alanına davet etti',
      'Daveti kabul etmek için dokun.',
      'space_invitation', v_id, null
    );
  end if;

  invitation_id := v_id;
  token := v_token;
  return next;
end;
$$;
revoke all on function public.create_space_invitation(uuid, text, text) from public, anon;
grant execute on function public.create_space_invitation(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- revoke_space_invitation
-- ─────────────────────────────────────────────
create or replace function public.revoke_space_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv record;
begin
  select * into v_inv from public.space_invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'Davet bulunamadı.' using errcode = 'P0002';
  end if;
  if coalesce(public.my_space_role(v_inv.space_id), '') not in ('owner', 'admin') then
    raise exception 'Bu daveti geri çekmek için yetkin yok.' using errcode = '42501';
  end if;
  if v_inv.status <> 'pending' then
    return;
  end if;
  update public.space_invitations set status = 'revoked', responded_at = now() where id = p_invitation_id;
  perform public.log_space_member_event(v_inv.space_id, 'invitation_revoked', jsonb_build_object('email', v_inv.email));
end;
$$;
revoke all on function public.revoke_space_invitation(uuid) from public, anon;
grant execute on function public.revoke_space_invitation(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- get_invitation_preview — davet bağlantısını açan kişiye gösterilecek
-- asgari bilgi. Token'ı bilen herkes görebilir (bağlantı zaten sırdır),
-- ama yalnızca alan adı/türü, rol ve davet edenin adı döner.
-- ─────────────────────────────────────────────
create or replace function public.get_invitation_preview(p_token text)
returns table (
  invitation_id uuid,
  space_name text,
  space_type text,
  role text,
  inviter_name text,
  email_hint text,
  status text,
  expired boolean,
  email_matches boolean,
  already_member boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_inv record;
  v_my_email text;
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  select i.*, s.name as space_name, s.type as space_type into v_inv
    from public.space_invitations i join public.spaces s on s.id = i.space_id
   where i.token = p_token;
  if not found then
    return;
  end if;
  select lower(email) into v_my_email from auth.users where id = auth.uid();

  invitation_id := v_inv.id;
  space_name := v_inv.space_name;
  space_type := v_inv.space_type;
  role := v_inv.role;
  select coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.display_name, 'Bir kullanıcı')
    into inviter_name from public.profiles p where p.user_id = v_inv.invited_by;
  -- E-postanın yalnızca maskeli hali (ör. ah***@gmail.com).
  email_hint := regexp_replace(v_inv.email, '^(.{1,2})[^@]*(@.*)$', '\1***\2');
  status := v_inv.status;
  expired := v_inv.expires_at < now();
  email_matches := v_my_email = v_inv.email;
  already_member := exists (select 1 from public.space_members where space_id = v_inv.space_id and user_id = auth.uid());
  return next;
end;
$$;
revoke all on function public.get_invitation_preview(text) from public, anon;
grant execute on function public.get_invitation_preview(text) to authenticated;

-- ─────────────────────────────────────────────
-- respond_to_invitation — kabul (p_accept=true) veya ret. Yalnızca
-- davet edilen e-postanın sahibi yanıtlayabilir.
-- ─────────────────────────────────────────────
create or replace function public.respond_to_invitation(p_token text, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv record;
  v_my_email text;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  select * into v_inv from public.space_invitations where token = p_token for update;
  if not found then
    raise exception 'Davet bulunamadı.' using errcode = 'P0002';
  end if;
  select lower(email) into v_my_email from auth.users where id = v_uid;
  if v_my_email is distinct from v_inv.email then
    raise exception 'Bu davet başka bir e-posta adresine gönderildi.' using errcode = '42501';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'Bu davet artık geçerli değil.' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Bu davetin süresi dolmuş. Alan sahibinden yeni davet iste.' using errcode = '22023';
  end if;

  if not p_accept then
    update public.space_invitations set status = 'declined', responded_at = now(), accepted_by = v_uid where id = v_inv.id;
    perform public.log_space_member_event(v_inv.space_id, 'invitation_declined', jsonb_build_object('email', v_inv.email));
    return v_inv.space_id;
  end if;

  if (select is_archived from public.spaces where id = v_inv.space_id) then
    raise exception 'Bu alan arşivlenmiş.' using errcode = '22023';
  end if;

  insert into public.space_members (space_id, user_id, role, accepted_at)
  values (v_inv.space_id, v_uid, v_inv.role, now())
  on conflict (space_id, user_id) do nothing;

  update public.space_invitations set status = 'accepted', responded_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform public.log_space_member_event(v_inv.space_id, 'member_joined', jsonb_build_object('user_id', v_uid, 'role', v_inv.role));
  return v_inv.space_id;
end;
$$;
revoke all on function public.respond_to_invitation(text, boolean) from public, anon;
grant execute on function public.respond_to_invitation(text, boolean) to authenticated;

-- ─────────────────────────────────────────────
-- get_my_pending_invitations — giriş yapan kişinin e-postasına gelen
-- bekleyen davetler (token dahil: kendi davetini açabilmesi için).
-- ─────────────────────────────────────────────
create or replace function public.get_my_pending_invitations()
returns table (invitation_id uuid, token text, space_name text, space_type text, role text, inviter_name text, created_at timestamptz, expires_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.token, s.name, s.type, i.role,
         coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.display_name, 'Bir kullanıcı'),
         i.created_at, i.expires_at
    from public.space_invitations i
    join public.spaces s on s.id = i.space_id
    left join public.profiles p on p.user_id = i.invited_by
   where i.status = 'pending'
     and i.expires_at > now()
     and i.email = (select lower(email) from auth.users where id = auth.uid())
     and not exists (select 1 from public.space_members m where m.space_id = i.space_id and m.user_id = auth.uid())
   order by i.created_at desc;
$$;
revoke all on function public.get_my_pending_invitations() from public, anon;
grant execute on function public.get_my_pending_invitations() to authenticated;

-- ─────────────────────────────────────────────
-- Üye yönetimi: rol değiştirme, çıkarma, ayrılma
-- Kurallar:
--   - Sahip (owner) rolü hiçbir RPC ile verilemez/alınamaz/çıkarılamaz.
--   - Sahip: diğer herkesin rolünü değiştirebilir ve herkesi çıkarabilir.
--   - Yönetici: yalnızca düzenleyici/izleyici üyeleri yönetebilir; kimseyi
--     yönetici yapamaz.
-- ─────────────────────────────────────────────
create or replace function public.update_space_member_role(p_space_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text := public.my_space_role(p_space_id);
  v_target_role text;
begin
  if p_role not in ('admin', 'editor', 'viewer') then
    raise exception 'Geçersiz rol.' using errcode = '22023';
  end if;
  select role into v_target_role from public.space_members where space_id = p_space_id and user_id = p_user_id for update;
  if v_target_role is null then
    raise exception 'Üye bulunamadı.' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Alan sahibinin rolü değiştirilemez.' using errcode = '42501';
  end if;
  if v_my_role = 'owner' then
    null; -- sahip her şeyi yapabilir (owner dışı)
  elsif v_my_role = 'admin' and v_target_role in ('editor', 'viewer') and p_role in ('editor', 'viewer') then
    null;
  else
    raise exception 'Bu değişikliği yapmak için yetkin yok.' using errcode = '42501';
  end if;
  if v_target_role = p_role then
    return;
  end if;
  update public.space_members set role = p_role where space_id = p_space_id and user_id = p_user_id;
  perform public.log_space_member_event(p_space_id, 'member_role_changed', jsonb_build_object('user_id', p_user_id, 'from', v_target_role, 'to', p_role));
end;
$$;
revoke all on function public.update_space_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.update_space_member_role(uuid, uuid, text) to authenticated;

create or replace function public.remove_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text := public.my_space_role(p_space_id);
  v_target_role text;
begin
  if p_user_id = auth.uid() then
    raise exception 'Kendini çıkarmak için "Alandan ayrıl" seçeneğini kullan.' using errcode = '22023';
  end if;
  select role into v_target_role from public.space_members where space_id = p_space_id and user_id = p_user_id for update;
  if v_target_role is null then
    raise exception 'Üye bulunamadı.' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Alan sahibi çıkarılamaz.' using errcode = '42501';
  end if;
  if not (v_my_role = 'owner' or (v_my_role = 'admin' and v_target_role in ('editor', 'viewer'))) then
    raise exception 'Bu üyeyi çıkarmak için yetkin yok.' using errcode = '42501';
  end if;
  delete from public.space_members where space_id = p_space_id and user_id = p_user_id;
  perform public.log_space_member_event(p_space_id, 'member_removed', jsonb_build_object('user_id', p_user_id, 'role', v_target_role));
end;
$$;
revoke all on function public.remove_space_member(uuid, uuid) from public, anon;
grant execute on function public.remove_space_member(uuid, uuid) to authenticated;

create or replace function public.leave_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.my_space_role(p_space_id);
begin
  if v_role is null then
    raise exception 'Bu alanın üyesi değilsin.' using errcode = 'P0002';
  end if;
  if v_role = 'owner' then
    raise exception 'Alan sahibi alandan ayrılamaz.' using errcode = '42501';
  end if;
  delete from public.space_members where space_id = p_space_id and user_id = auth.uid();
  perform public.log_space_member_event(p_space_id, 'member_left', jsonb_build_object('user_id', auth.uid(), 'role', v_role));
end;
$$;
revoke all on function public.leave_space(uuid) from public, anon;
grant execute on function public.leave_space(uuid) to authenticated;

-- Üye listesinde ad göstermek için: aynı alanın üyelerinin görünen adları
-- ve e-postaları (yalnızca alan üyeleri çağırabilir).
create or replace function public.get_space_members(p_space_id uuid)
returns table (user_id uuid, role text, display_name text, email text, joined_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Bu alanın üyesi değilsin.' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role,
           coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.display_name, u.email)::text,
           u.email::text,
           coalesce(m.accepted_at, m.created_at)
      from public.space_members m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.user_id = m.user_id
     where m.space_id = p_space_id
     order by case m.role when 'owner' then 0 when 'admin' then 1 when 'editor' then 2 else 3 end, m.created_at;
end;
$$;
revoke all on function public.get_space_members(uuid) from public, anon;
grant execute on function public.get_space_members(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 3) Abonelik bitiş hatırlatması
-- ─────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('debt_due', 'budget_80', 'budget_exceeded', 'transfer_created', 'space_invite', 'support_reply', 'subscription_expiring'));

-- Bitişine 7 gün veya daha az kalan aktif abonelikler için (her bitiş
-- tarihi başına BİR KEZ) ve süresi yeni dolanlar için (bir kez) bildirim.
-- Ev Premium: sahibe. İşletme Premium: alanın sahip ve yöneticilerine.
-- İdempotent: aynı (kullanıcı, tür, abonelik, başlık) için tekrar üretmez.
create or replace function public.create_subscription_expiry_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_sub record;
  v_user uuid;
  v_title text;
  v_body text;
  v_space_id uuid;
  v_end_label text;
begin
  for v_sub in
    select s.*, sp.name as space_name
      from public.subscriptions s
      left join public.spaces sp on sp.id = s.space_id
     where s.status = 'active'
       and s.current_period_end is not null
       and s.current_period_end < now() + interval '7 days'
       and s.current_period_end > now() - interval '3 days'
  loop
    v_end_label := to_char(v_sub.current_period_end at time zone 'Europe/Istanbul', 'DD.MM.YYYY');
    if v_sub.current_period_end > now() then
      v_title := case when v_sub.plan = 'home_premium' then 'Ev Premium' else 'İşletme Premium (' || coalesce(v_sub.space_name, 'alan') || ')' end
                 || ' ' || v_end_label || ' tarihinde bitiyor';
      v_body := 'Premium özelliklerin kesintisiz devam etmesi için süreni uzat.';
    else
      v_title := case when v_sub.plan = 'home_premium' then 'Ev Premium' else 'İşletme Premium (' || coalesce(v_sub.space_name, 'alan') || ')' end
                 || ' süren doldu';
      v_body := 'Premium özellikler kapandı. Dilediğin zaman yeniden başlatabilirsin.';
    end if;
    v_space_id := v_sub.space_id;

    for v_user in
      select v_sub.owner_user_id where v_sub.plan = 'home_premium'
      union
      select m.user_id from public.space_members m
       where v_sub.plan = 'business' and m.space_id = v_sub.space_id and m.role in ('owner', 'admin')
    loop
      if v_user is null then
        continue;
      end if;
      if exists (
        select 1 from public.notifications n
         where n.user_id = v_user and n.type = 'subscription_expiring'
           and n.entity_id = v_sub.id and n.title = v_title
      ) then
        continue;
      end if;
      perform public.create_notification(v_user, 'subscription_expiring', v_title, v_body, 'subscription', v_sub.id, v_space_id);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.create_subscription_expiry_notifications() from public, anon, authenticated;
grant execute on function public.create_subscription_expiry_notifications() to service_role;

-- ─────────────────────────────────────────────
-- 4) Zamanlanmış görev: tekrarlayan kurallar + hatırlatmalar
-- ─────────────────────────────────────────────
-- Sıra önemli: önce tekrarlayan kurallardan borçlar üretilir, ardından
-- vade bildirimleri bu yeni borçları da kapsar.
create or replace function public.run_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  perform public.generate_due_recurring_debts();
  perform public.create_debt_due_notifications();

  for v_book_id in select id from public.books loop
    perform public.create_budget_alert_notifications(v_book_id);
  end loop;

  perform public.create_subscription_expiry_notifications();
end;
$$;

revoke all on function public.run_scheduled_notifications() from public;
grant execute on function public.run_scheduled_notifications() to service_role;
