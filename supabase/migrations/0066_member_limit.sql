-- 0066_member_limit.sql
-- Amaç: Ücretsiz planda alan sahibi dışında EN FAZLA 1 üye (bekleyen
-- davetler dahil). Premium'da sınırsız:
--   - Ev alanı: sahibin Ev Premium'u (has_home_premium)
--   - İşletme alanı: alanın İşletme Premium'u (has_business_subscription)
-- Sınır hem davet oluştururken hem kabul ederken VERİTABANINDA uygulanır.
-- Premium sona ererse mevcut üyeler ÇIKARILMAZ; yalnızca yeni davet/kabul
-- engellenir. create_space_invitation ve respond_to_invitation, 0065'teki
-- gövdeleriyle aynıdır; yalnızca limit kontrolü eklendi.

-- Ücretsiz planın sahip dışı üye sınırı (uygulamadaki FREE_EXTRA_MEMBER_LIMIT ile aynı).
create or replace function public.free_extra_member_limit()
returns integer
language sql
immutable
as $$ select 1 $$;

-- Alanın sahip dışı üye sınırı; null = sınırsız (Premium).
create or replace function public.space_extra_member_limit(p_space_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case
    when s.type = 'home' and public.has_home_premium(s.owner_user_id) then null
    when s.type = 'business' and public.has_business_subscription(s.id) then null
    else public.free_extra_member_limit()
  end
  from public.spaces s where s.id = p_space_id;
$$;

-- Sahip dışı üyeler + süresi dolmamış bekleyen davetler.
create or replace function public.space_extra_member_usage(p_space_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select (
    select count(*) from public.space_members m join public.spaces s on s.id = m.space_id
     where m.space_id = p_space_id and m.user_id <> s.owner_user_id
  )::integer + (
    select count(*) from public.space_invitations i
     where i.space_id = p_space_id and i.status = 'pending' and i.expires_at > now()
  )::integer;
$$;

revoke all on function public.space_extra_member_limit(uuid) from public, anon, authenticated;
revoke all on function public.space_extra_member_usage(uuid) from public, anon, authenticated;

-- Arayüz için kota (kullanım + sınır). Yalnızca alan üyeleri çağırabilir.
create or replace function public.get_space_member_quota(p_space_id uuid)
returns table (used integer, member_limit integer)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Bu alanın üyesi değilsin.' using errcode = '42501';
  end if;
  used := public.space_extra_member_usage(p_space_id);
  member_limit := public.space_extra_member_limit(p_space_id);
  return next;
end;
$$;
revoke all on function public.get_space_member_quota(uuid) from public, anon;
grant execute on function public.get_space_member_quota(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- create_space_invitation (0065 + limit)
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
  v_limit integer;
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

  -- Ücretsiz plan üye sınırı (yeniden gönderimde eski davet yukarıda
  -- geri çekildiği için sayılmaz).
  v_limit := public.space_extra_member_limit(p_space_id);
  if v_limit is not null and public.space_extra_member_usage(p_space_id) >= v_limit then
    raise exception 'Ücretsiz planda alan sahibi dışında en fazla % üye olabilir (bekleyen davetler dahil). Daha fazla üye için Premium''a geç.', v_limit
      using errcode = 'P0001', hint = 'member_limit';
  end if;

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
-- respond_to_invitation (0065 + limit)
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
  v_limit integer;
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

  -- Kabul anında da sınır: yalnızca mevcut (sahip dışı) üyeler sayılır.
  v_limit := public.space_extra_member_limit(v_inv.space_id);
  if v_limit is not null and (
    select count(*) from public.space_members m join public.spaces s on s.id = m.space_id
     where m.space_id = v_inv.space_id and m.user_id <> s.owner_user_id
  ) >= v_limit then
    raise exception 'Bu alan ücretsiz planda üye sınırına ulaştı. Alan sahibinin Premium''a geçmesi gerekiyor.'
      using errcode = 'P0001', hint = 'member_limit';
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
-- Yardım Merkezi içeriği: üye daveti ve plan farkı
-- ─────────────────────────────────────────────
update public.help_articles
   set body = $b$Ev Premium, Ev alanında sınırsız hesap ve sınırsız üye sağlar. Alanın sahibi Premium ise alandaki tüm üyeler faydalanır.

İşletme Premium, ilgili İşletme alanındaki ücretsiz plan limitlerini (hesap, aylık işlem, borç, müşteri, tedarikçi) kaldırır ve sınırsız ekip üyesi ekleyebilmeni sağlar. Her İşletme alanı için ayrı alınır.

Ücretsiz planda her alana, sahibi dışında 1 üye davet edebilirsin (bekleyen davetler dahil).

Abonelikler otomatik yenilenmez. Süren dolmadan 7 gün önce uygulama içinde hatırlatma alırsın; süre dolduğunda plan sayfasından yeniden satın alabilirsin. Premium sona ererse mevcut üyeler alandan çıkarılmaz, yalnızca yeni üye eklenemez.

Banka havalesiyle ödeme yaptıysan, ödemeyi bildirdikten sonra ekibimiz kontrol edip aboneliğini genellikle 1 iş günü içinde aktif eder.$b$
 where slug = 'abonelik-nasil-calisir';

insert into public.help_articles
  (category_id, slug, title, summary, body, steps, tags, related_path, related_label, context_keys, is_faq, sort_order, status)
select c.id,
  'alana-uye-davet-etme',
  'Alanıma nasıl üye davet ederim?',
  'Ailenden birini veya ekip arkadaşını e-posta adresiyle alanına davet edebilir, rolünü belirleyebilirsin.',
  $b$Bir alanı başkalarıyla birlikte kullanmak için Ayarlar → Alanlarım → Üyeler ekranından davet oluşturursun. Davet ettiğin kişi aynı e-posta adresiyle Parakip'e giriş yapıp daveti kabul edince alanın hesaplarını ve kayıtlarını görmeye başlar. Kendi alanları ayrı kalır; sen de onun alanlarını göremezsin.

Roller:
- Yönetici: kayıtları yönetir, üye davet eder ve düzenleyici/izleyici üyeleri yönetir.
- Düzenleyici: gelir, gider, borç ve bütçe kaydı ekler ve düzenler.
- İzleyici: yalnızca görüntüler.

Alanın sahipliği devredilemez. Davetler 7 gün geçerlidir; bekleyen bir daveti istediğin zaman geri çekebilirsin.

Ücretsiz planda her alana, sahibi dışında 1 üye eklenebilir (bekleyen davetler dahil). Ev Premium ve İşletme Premium'da üye sayısı sınırsızdır.$b$,
  jsonb_build_array(
    'Ayarlar → Alanlarım ekranında alanın altındaki "Üyeler"e dokun.',
    'Davet edeceğin kişinin e-posta adresini yaz ve rolünü seç.',
    '"Davet oluştur"a dokun, çıkan bağlantıyı WhatsApp veya e-postayla paylaş.',
    'Kişi bağlantıyı açıp aynı e-postayla giriş yaptığında daveti kabul eder.'),
  array['davet', 'üye', 'ekip', 'aile', 'rol', 'paylaş'],
  '/settings/spaces', 'Alanlarıma git', array['settings'], true, 25, 'published'
from public.help_categories c
where c.slug = 'baslarken'
on conflict (slug) do nothing;
