-- 0060_manual_bank_transfer_payments.sql
-- Amaç: Kart ile ödeme sağlayıcısı (Shopier/Iyzico/Paycell) onayı
-- gelene kadar (ve muhtemelen ondan SONRA da bir alternatif olarak),
-- Ev Premium/İşletme Premium için BANKA HAVALESİ/EFT ile MANUEL ödeme
-- akışı. SAF EKLEME — subscriptions tablosu ve mevcut plan kontrolü
-- fonksiyonları (has_home_premium/has_business_subscription) HİÇ
-- DEĞİŞTİRİLMEDİ; bu akış yalnızca subscriptions'a YAZMANIN YENİ bir
-- (admin onaylı) yoludur.
--
-- AKIŞ: (1) Kullanıcı IBAN'a havale/EFT yapar (uygulama dışında,
-- kendi bankasından), (2) Uygulamada "Ödemeyi bildirdim" der — bu bir
-- `manual_payment_requests` satırı oluşturur (status='pending'),
-- HENÜZ HİÇBİR ABONELİK AKTİFLEŞMEZ, (3) Platform admin (bkz. migration
-- 0058) /admin panelinden banka hesap hareketlerini elle kontrol edip
-- talebi onaylar/reddeder — YALNIZCA onaylandığında subscriptions
-- güncellenir. Bu, "sahte aktif abonelik gösterme" ilkesiyle TAM
-- uyumludur: kimse kendi kendine "ödedim" diyerek aboneliğini
-- aktifleştiremez.

create table public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('home_premium', 'business')),
  space_id uuid not null references public.spaces (id) on delete cascade,
  period text not null check (period in ('monthly', 'yearly')),
  amount_cents bigint not null check (amount_cents > 0),
  -- Kullanıcının banka açıklamasına yazması istenen, kısa ve BENZERSİZ
  -- referans kodu — admin, banka ekstresinde bu kodu arayarak hangi
  -- talebe ait ödemeyi bulacağını bilir.
  reference_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

comment on table public.manual_payment_requests is
  'Banka havalesi/EFT ile MANUEL ödeme bildirimleri. Yalnızca platform '
  'admin onayladığında (bkz. /admin panel) ilgili subscriptions satırı '
  'güncellenir — bir kullanıcı kendi talebini ASLA kendisi onaylayamaz.';

create index manual_payment_requests_status_idx on public.manual_payment_requests (status, created_at desc);

alter table public.manual_payment_requests enable row level security;

-- Kullanıcı yalnızca KENDİ taleplerini görebilir (durumunu takip
-- edebilmesi için) — başka bir kullanıcının ödeme talebini/tutarını
-- ASLA göremez.
create policy manual_payment_requests_select_own
  on public.manual_payment_requests for select
  using (user_id = auth.uid());

-- Kullanıcı yeni bir talep oluşturabilir (yalnızca kendi adına,
-- status='pending' ile — approved/rejected durumunu KENDİSİ ASLA
-- ayarlayamaz, bu with check ile garanti edilir).
create policy manual_payment_requests_insert_own
  on public.manual_payment_requests for insert
  with check (user_id = auth.uid() and status = 'pending');

-- UPDATE politikası BİLİNÇLİ OLARAK YOKTUR — onay/red işlemi YALNIZCA
-- service_role (admin panel route'ları) tarafından yapılabilir, RLS
-- bypass edilerek. authenticated rolüne update GRANT edilmez.
grant select, insert on public.manual_payment_requests to authenticated;
