-- 0058_platform_admins.sql
-- Amaç: Uygulama genelinde (tüm alan/kullanıcı sınırlarını aşan) TAM
-- erişimli bir admin paneli için gerekli minimum altyapı. SAF EKLEME —
-- mevcut RLS, space-level roller (owner/admin/editor/viewer) ve
-- finansal RPC'ler HİÇ DEĞİŞTİRİLMEDİ; bu, TAMAMEN AYRI, platform
-- seviyesinde bir yetki katmanıdır.
--
-- GÜVENLİK TASARIMI:
-- - `platform_admins` tablosuna authenticated rolünden HİÇBİR yazma
--   izni verilmez (yalnızca service_role INSERT/DELETE edebilir) — bu,
--   bir kullanıcının KENDİSİNİ admin yapmasını (privilege escalation)
--   veritabanı seviyesinde imkansız kılar. İlk admin, Supabase SQL
--   Editor'den service_role bağlamında elle eklenir (bkz. dokümantasyon).
-- - Admin paneli sayfaları/route'ları RLS'i BYPASS ETMEK için
--   service_role client kullanır (src/lib/supabase/service.ts) — bu
--   NEDENLE her admin route'unun kendi içinde is_platform_admin()
--   kontrolünü yapması ZORUNLUDUR (RLS koruması burada YOKTUR).
-- - `platform_admin_audit_log` — kullanıcının AÇIK talebiyle admin
--   erişimi hiçbir şekilde KISITLANMAMIŞTIR (tam/sınırsız erişim
--   isteği karşılanmıştır); bu tablo YALNIZCA "ne olduğunu" kaydeder,
--   hiçbir işlemi ENGELLEMEZ veya YAVAŞLATMAZ.

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by text,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Platform genelinde (tüm alan/kullanıcı sınırlarını aşan) TAM admin '
  'erişimine sahip kullanıcılar. Yalnızca service_role tarafından '
  'yazılabilir — bir kullanıcı KENDİSİNİ asla admin yapamaz.';

alter table public.platform_admins enable row level security;

-- Bilinçli olarak: authenticated rolüne HİÇBİR politika (SELECT dahil)
-- verilmez. Bir kullanıcının admin OLUP OLMADIĞINI kontrol etmek için
-- is_platform_admin() SECURITY DEFINER fonksiyonu kullanılır — bu,
-- tablo içeriğinin (kim admin, kim değil) normal kullanıcılara hiç
-- ifşa edilmemesini sağlar.

create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where user_id = p_user_id);
$$;

revoke all on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- Admin işlem kaydı — erişimi KISITLAMAZ, yalnızca İZ BIRAKIR. Admin
-- paneli route'ları, service_role ile yaptıkları her DEĞİŞİKLİK
-- (düzenleme/iptal/profil güncelleme) sonrası buraya bir satır ekler.
-- ─────────────────────────────────────────────

create table public.platform_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

comment on table public.platform_admin_audit_log is
  'Admin panelinden yapılan işlemlerin kaydı — hiçbir işlemi ENGELLEMEZ, '
  'yalnızca kim/ne zaman/ne yaptığını kaydeder. Yalnızca service_role '
  'yazabilir/okuyabilir.';

alter table public.platform_admin_audit_log enable row level security;
-- Bilinçli olarak: authenticated rolüne HİÇBİR politika verilmez —
-- yalnızca service_role (admin panel route'ları) erişebilir.
