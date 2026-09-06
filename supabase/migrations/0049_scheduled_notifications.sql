-- 0049_scheduled_notifications.sql
-- Amaç: 0048'de hazırlanan create_debt_due_notifications() ve
-- create_budget_alert_notifications() fonksiyonlarını ÜRETİME UYGUN hale
-- getirmek. SAF GÜNCELLEME — CREATE OR REPLACE ile AYNI imzalar korunuyor,
-- hiçbir mevcut tablo/RLS/trigger/diğer fonksiyon değişmiyor.
--
-- 0048'deki halleriyle ilgili İKİ GERÇEK SORUN vardı:
--   1) İDEMPOTENT DEĞİLDİ: Görev günde birden fazla kez (veya art arda)
--      çalıştırılırsa AYNI borç/bütçe için HER SEFERİNDE yeni bir bildirim
--      oluşturuyordu. Şimdi: aynı (user_id, type, entity_id, title) için
--      zaten bir bildirim varsa YENİDEN OLUŞTURULMAZ. "Yaklaşan vade" →
--      "Vadesi geçti" gibi bir AŞAMA DEĞİŞİKLİĞİ farklı bir title taşıdığı
--      için yine de (yalnızca BİR KEZ) yeni bir bildirim üretir — bu
--      kasıtlıdır, aşama değişikliği gerçek bir yeni bilgidir.
--   2) SAAT DİLİMİ: current_date, veritabanı sunucusunun (genelde UTC)
--      oturum saat dilimini kullanıyordu. Uygulama TR pazarına özel
--      olduğu için (henüz kullanıcı bazlı saat dilimi tercihi şemada YOK),
--      artık açıkça 'Europe/Istanbul' saat dilimine göre "bugün"
--      hesaplanıyor. Kullanıcı bazlı saat dilimi ileride eklenirse bu
--      fonksiyonlar profiles'a yeni bir sütun eklenerek genişletilebilir.

create or replace function public.create_debt_due_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_row record;
  v_member record;
  v_title text;
  v_notif_id uuid;
begin
  for v_row in
    select d.id, d.counterparty_name, d.due_date, d.direction, d.book_id, b.space_id,
      (d.due_date < v_today) as is_overdue
    from public.debts d
    join public.books b on b.id = d.book_id
    where d.status in ('open', 'partial')
      and d.due_date is not null
      and d.due_date <= v_today + interval '3 days'
  loop
    v_title := case when v_row.is_overdue then 'Vadesi geçmiş ödeme' else 'Yaklaşan vade' end;

    for v_member in
      select user_id from public.space_members where space_id = v_row.space_id
    loop
      -- İDEMPOTENCY: aynı kullanıcı + aynı borç + AYNI AŞAMA (title) için
      -- daha önce bir bildirim üretildiyse SESSİZCE ATLA.
      if exists (
        select 1 from public.notifications
        where user_id = v_member.user_id
          and type = 'debt_due'
          and entity_id = v_row.id
          and title = v_title
      ) then
        continue;
      end if;

      select public.create_notification(
        v_member.user_id,
        'debt_due',
        v_title,
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
  'çalışmaz. İDEMPOTENTTİR: aynı borç+aşama için tekrar tekrar çağrılsa bile '
  'yalnızca BİR KEZ bildirim üretir. "Bugün", Europe/Istanbul saat dilimine '
  'göre hesaplanır. Günde bir kez (ör. pg_cron veya harici cron ile) '
  'service_role tarafından çağrılması tasarlanmıştır — bkz. '
  'run_scheduled_notifications().';

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
  v_type text;
  v_title text;
begin
  select space_id into v_space_id from public.books where id = p_book_id;
  if v_space_id is null then
    return 0; -- gecersiz/erisilemeyen book_id icin sessizce hicbir sey yapma
  end if;

  for v_row in
    select * from public.budget_usage where book_id = p_book_id and percent_used >= 80
  loop
    v_type := case when v_row.percent_used >= 100 then 'budget_exceeded' else 'budget_80' end;
    v_title := case when v_row.percent_used >= 100 then 'Bütçe aşıldı' else 'Bütçe %80 seviyesinde' end;

    for v_member in
      select user_id from public.space_members where space_id = v_space_id
    loop
      -- İDEMPOTENCY: %80 ve aşım AYRI type değerleri olduğu için, bir
      -- bütçe %80'den aşıma geçtiğinde YENİ (tek seferlik) bir bildirim
      -- üretilir — ama AYNI eşik için asla tekrar üretilmez. Bütçeler
      -- period_month bazlı ayrı satırlar olduğundan (bkz. budgets tablosu),
      -- her yeni ay zaten doğal olarak yeni bir budget_id ile başlar.
      if exists (
        select 1 from public.notifications
        where user_id = v_member.user_id
          and type = v_type
          and entity_id = v_row.budget_id
      ) then
        continue;
      end if;

      select public.create_notification(
        v_member.user_id,
        v_type,
        v_title,
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
  'ZAMANLANMIŞ GÖREV GEREKTİRİR veya bir transaction_entries trigger''ı ile '
  'event-driven hale getirilebilir (bu turda YAPILMADI). İDEMPOTENTTİR: bir '
  'bütçe için aynı eşik (%80 veya aşım) yalnızca BİR KEZ bildirim üretir — '
  'her budget_id zaten period_month bazlı olduğundan yeni ay otomatik temiz '
  'sayfa açar.';

-- ─────────────────────────────────────────────
-- run_scheduled_notifications — pg_cron/harici zamanlayıcının çağıracağı
-- TEK giriş noktası. Yalnızca service_role çalıştırabilir. Kendi içinde
-- book bazlı döngü yaparak create_budget_alert_notifications'ı her defter
-- için çağırır — çağıran tarafın book_id'leri tek tek bilmesine gerek yok.
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
  perform public.create_debt_due_notifications();

  for v_book_id in select id from public.books loop
    perform public.create_budget_alert_notifications(v_book_id);
  end loop;
end;
$$;

comment on function public.run_scheduled_notifications is
  'OTOMATIK BILDIRIMLERIN TEK GIRIS NOKTASI. Bu fonksiyonun kendisi hicbir '
  'zamanlayiciya bagli DEGILDIR - bu migration yalnizca fonksiyonu hazirlar. '
  'Gercek otomasyon icin (bu turun kapsami DISINDA, kurulum gerekir): '
  'ya (A) Supabase pg_cron eklentisi acikken SQL Editor uzerinden '
  'cron.schedule cagrisiyla gunde bir kez run_scheduled_notifications() '
  'planlanmali (pg_cron UTC calisir, TR saatine gore ayarlanmali), '
  'ya da (B) harici bir zamanlayici (Vercel Cron/GitHub Actions) service_role '
  'anahtariyla bir Edge Function tetikleyip bu RPCyi orada cagirmali. '
  'Her iki yontemde de bu fonksiyon YALNIZCA service_role baglaminda '
  'calisir; anon/authenticated anahtarla asla cagrilamaz. Ayrintili '
  'kurulum adimlari proje raporunda belgelenmistir.';

revoke all on function public.run_scheduled_notifications() from public;
grant execute on function public.run_scheduled_notifications() to service_role;
