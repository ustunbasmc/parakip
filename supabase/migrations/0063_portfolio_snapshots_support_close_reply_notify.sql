-- 0063_portfolio_snapshots_support_close_reply_notify.sql
-- Amaç:
--   1) Yatırım portföyü için GÜNLÜK değer anlık görüntüleri (trend grafiği).
--   2) Kullanıcının kendi destek talebini kapatabilmesi (kontrollü RPC).
--   3) Admin yanıtında uygulama içi bildirim için yeni bildirim türü.
--
-- Finansal tablolar (transactions, entries, holdings, budgets…), onların
-- RPC'leri, RLS politikaları ve audit_log bu migration'da DEĞİŞTİRİLMEZ.

-- ─────────────────────────────────────────────
-- 1) portfolio_value_snapshots
-- ─────────────────────────────────────────────
-- Günde bir kez, piyasa fiyatı güncelleme cron'u (service_role) yazar.
-- Değerleme kuralı uygulamadaki computePortfolioTotals ile AYNIDIR:
-- fiyatı olan varlık fiyat × miktar, fiyatı olmayan varlık maliyet
-- tabanıyla sayılır. priced_count, değerin ne kadarının gerçek piyasa
-- fiyatına dayandığını dürüstçe göstermek için saklanır.
create table if not exists public.portfolio_value_snapshots (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  snapshot_date date not null,
  value_cents bigint not null check (value_cents >= 0),
  cost_basis_cents bigint not null check (cost_basis_cents >= 0),
  holding_count integer not null check (holding_count >= 0),
  priced_count integer not null check (priced_count >= 0),
  created_at timestamptz not null default now(),
  unique (book_id, snapshot_date)
);

comment on table public.portfolio_value_snapshots is
  'Defter başına günlük portföy değeri anlık görüntüsü (Türkiye saatine göre '
  'gün). Yalnızca service_role (cron) yazar; defter üyeleri okuyabilir.';

alter table public.portfolio_value_snapshots enable row level security;

drop policy if exists portfolio_value_snapshots_select_member on public.portfolio_value_snapshots;
create policy portfolio_value_snapshots_select_member
  on public.portfolio_value_snapshots for select
  using (public.is_book_member(book_id));

revoke all on public.portfolio_value_snapshots from anon, authenticated;
grant select on public.portfolio_value_snapshots to authenticated;

-- ─────────────────────────────────────────────
-- 2) close_own_support_ticket
-- ─────────────────────────────────────────────
-- Kullanıcının support_tickets üzerinde UPDATE yetkisi YOKTUR (bkz. 0061).
-- Bu fonksiyon, yalnızca talebin sahibinin, yalnızca 'closed' durumuna
-- geçirmesine izin veren TEK kontrollü yoldur. Olay kaydı mevcut
-- support_tickets_status_change trigger'ı tarafından auth.uid() ile
-- (actor_role = 'user') yazılır.
create or replace function public.close_own_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;

  select status into v_status
    from public.support_tickets
   where id = p_ticket_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'Talep bulunamadı.' using errcode = 'P0002';
  end if;

  if v_status = 'closed' then
    return; -- zaten kapalı: idempotent
  end if;

  update public.support_tickets set status = 'closed' where id = p_ticket_id;
end;
$$;

revoke all on function public.close_own_support_ticket(uuid) from public, anon;
grant execute on function public.close_own_support_ticket(uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 3) Bildirim türü: support_reply
-- ─────────────────────────────────────────────
-- Admin paneli (service_role) bir talebe kullanıcıya görünür yanıt
-- yazdığında talep sahibine uygulama içi bildirim düşer. Tercihlerde ayrı
-- bir anahtarı yoktur (create_notification'da 'else true'): kullanıcının
-- kendi açtığı talebe gelen yanıt her zaman iletilir.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('debt_due', 'budget_80', 'budget_exceeded', 'transfer_created', 'space_invite', 'support_reply'));
