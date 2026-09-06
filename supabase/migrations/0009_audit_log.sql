-- 0009_audit_log.sql
-- Amaç: Aktör (kim yaptı) bilgisini transactions header'ından tamamen
-- ayırıp (D8), defter bazlı ve yalnızca owner/admin'e açık bir denetim
-- izine taşımak.
--
-- KARAR: book_id NOT NULL (her satır kesin bir deftere aittir),
-- actor_user_id NULLABLE (ileride sistem/otomatik işlemler için).
--
-- Cross-book (Ev-İşletme) bir işlemde HER DEFTER İÇİN AYRI bir satır
-- yazılır; her satırın before/after alanı YALNIZCA o deftere ait entry
-- bilgisini içerir — karşı tarafın hesap adı/tutarı/notu/kullanıcısı
-- bu satıra asla yazılmaz (bkz. 0010, 0011).

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'cancelled')),
  entity_type text not null check (entity_type in ('transaction_entry')),
  entity_id uuid not null, -- transaction_entries.id — kasıtlı FK YOK
                           -- (ileride başka entity_type'lar eklenebilsin diye
                           -- polymorphic referans olarak bırakıldı)
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Defter bazlı denetim izi. transactions.created_by/cancelled_by BİLEREK yok '
  '(D8) — bu bilgi yalnızca burada, yalnızca owner/admin''e açık olarak tutulur. '
  'Cross-book işlemlerde her defter için ayrı satır yazılır; before/after '
  'yalnızca o deftere ait veriyi içerir.';

create index audit_log_book_id_idx on public.audit_log (book_id, created_at desc);
create index audit_log_transaction_id_idx on public.audit_log (transaction_id, action, created_at);

-- ─────────────────────────────────────────────
-- RLS: yalnızca ilgili defterde owner/admin görebilir. editor/viewer
-- rolündeki kullanıcılar audit_log'a HİÇ erişemez — kendi eklediği bir
-- işlemin audit kaydını dahi göremez; UI'da yalnızca genel "ekip üyesi
-- tarafından eklendi" etiketi görür.
-- ─────────────────────────────────────────────

alter table public.audit_log enable row level security;

create policy audit_log_select_owner_admin
  on public.audit_log for select
  using (public.has_book_role(book_id, array['owner', 'admin']));

-- Bilinçli olarak: INSERT/UPDATE/DELETE politikası TANIMLANMADI ve
-- authenticated rolüne bu izinler HİÇ GRANT EDİLMEDİ. audit_log'a yazma
-- yalnızca SECURITY DEFINER fonksiyonlar (create_transfer,
-- create_simple_transaction) üzerinden, tablo sahibinin yetkisiyle
-- yapılır — istemciden doğrudan bir insert denemesi RLS'ten önce GRANT
-- seviyesinde zaten reddedilir ("permission denied for table audit_log").

grant select on public.audit_log to authenticated;
