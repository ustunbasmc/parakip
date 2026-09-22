-- 0061_help_center_and_support.sql
-- Amaç: Uygulama içi Yardım Merkezi (kategori + makale + geri bildirim)
-- ve Destek Talebi sistemi (talep + mesaj + ekran görüntüsü + olay
-- kaydı). SAF EKLEME — mevcut finansal tablolar, RPC'ler, audit_log ve
-- defter/alan izolasyonu HİÇ DEĞİŞTİRİLMEDİ.
--
-- İDEMPOTENT: Bu dosya (önceki migration'ların aksine, bilinçli olarak)
-- tekrar çalıştırılabilir — `if not exists`, `create or replace`,
-- `drop ... if exists` + yeniden oluşturma kullanılır.
--
-- GÜVENLİK TASARIMI:
-- - Destek tabloları HİÇBİR finansal tabloya (books/transactions/
--   accounts) referans VERMEZ. Talepte yalnızca alan TÜRÜ (home/business)
--   saklanır, alan kimliği SAKLANMAZ — destek sistemi üzerinden hiçbir
--   finansal kayda erişim yolu açılmaz.
-- - Kullanıcı yalnızca KENDİ taleplerini, kendi taleplerindeki İÇ NOT
--   OLMAYAN mesajları ve kendi ekran görüntülerini görebilir.
-- - Durum (status) ve öncelik (priority) kullanıcı tarafından
--   AYARLANAMAZ: öncelik trigger ile sistem tarafından belirlenir,
--   authenticated rolüne support_tickets üzerinde UPDATE yetkisi
--   verilmez. Kullanıcı yanıt yazdığında durum değişikliği SECURITY
--   DEFINER trigger ile yapılır.
-- - Admin işlemleri (yanıt, durum değişikliği, makale yönetimi) mevcut
--   platform admin yapısıyla (0058) service_role üzerinden yapılır ve
--   platform_admin_audit_log'a kaydedilir.
-- - AI HAZIRLIĞI: makale gövdesi düz metin + adımlar (jsonb dizi) olarak
--   tutulur; HTML yoktur. İleride bir destek asistanı YALNIZCA
--   status='published' makaleleri okuyacak şekilde bağlanmalıdır — bakiye
--   yorumu, yatırım tavsiyesi, işlem oluşturma/değiştirme veya başka
--   alanlara erişim yetkisi VERİLMEMELİDİR.

-- ─────────────────────────────────────────────
-- 0) Türkçe uyumlu arama normalizasyonu
-- ─────────────────────────────────────────────
-- "Şifre", "sifre", "ŞİFRE" ve "şifre" aynı sonucu versin diye: Türkçe
-- karakterler ASCII karşılıklarına çevrilir, sonra küçük harfe
-- dönüştürülür. translate() lower()'dan ÖNCE uygulanır — böylece
-- veritabanı collation'ından bağımsız olarak "I/İ/ı/i" hepsi "i" olur.
create or replace function public.help_normalize(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(translate(coalesce(p_text, ''), 'ÇĞİIÖŞÜçğıöşüÂÎÛâîû', 'CGIIOSUcgiosuAIUaiu'));
$$;

-- ─────────────────────────────────────────────
-- 1) Yardım kategorileri
-- ─────────────────────────────────────────────
create table if not exists public.help_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 240),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.help_categories is
  'Yardım Merkezi kategorileri. Authenticated kullanıcılar yalnızca aktif '
  'kategorileri okuyabilir; yazma yalnızca service_role (admin paneli).';

drop trigger if exists help_categories_set_updated_at on public.help_categories;
create trigger help_categories_set_updated_at
  before update on public.help_categories
  for each row execute function public.set_updated_at();

alter table public.help_categories enable row level security;

drop policy if exists help_categories_select_active on public.help_categories;
create policy help_categories_select_active
  on public.help_categories for select
  to authenticated
  using (is_active);

grant select on public.help_categories to authenticated;

-- ─────────────────────────────────────────────
-- 2) Yardım makaleleri
-- ─────────────────────────────────────────────
create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.help_categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 140),
  -- Kısa ve sade açıklama (liste ve arama sonuçlarında görünür).
  summary text not null check (char_length(summary) between 1 and 400),
  -- Düz metin gövde; paragraflar boş satırla ayrılır. HTML DESTEKLENMEZ
  -- (XSS riski yok, AI için temiz kaynak).
  body text not null default '' check (char_length(body) <= 20000),
  -- Adım adım anlatım: ["Adım 1", "Adım 2", ...]
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  tags text[] not null default '{}',
  -- İlgili ekrana yönlendirme butonu (yalnızca uygulama içi yol).
  related_path text check (related_path is null or related_path ~ '^/[A-Za-z0-9/_?=&-]*$'),
  related_label text check (char_length(related_label) <= 60),
  -- Bağlam duyarlı yardım anahtarları (ör. 'budgets', 'transaction-form').
  context_keys text[] not null default '{}',
  is_faq boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 100,
  -- Arama için normalize edilmiş metin — trigger ile doldurulur.
  search_text text not null default '',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.help_articles is
  'Yardım makaleleri. Normal kullanıcılar YALNIZCA status=published '
  'makaleleri görebilir; taslak ve arşiv makaleler yalnızca admin '
  'paneline (service_role) açıktır.';

create index if not exists help_articles_category_idx on public.help_articles (category_id, status, sort_order);
create index if not exists help_articles_status_idx on public.help_articles (status);
create index if not exists help_articles_context_keys_idx on public.help_articles using gin (context_keys);

create or replace function public.help_articles_before_write()
returns trigger
language plpgsql
as $$
begin
  new.search_text := public.help_normalize(
    coalesce(new.title, '') || ' ' ||
    coalesce(new.summary, '') || ' ' ||
    coalesce(new.body, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
    coalesce((select string_agg(value, ' ') from jsonb_array_elements_text(new.steps)), '')
  );
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists help_articles_before_write on public.help_articles;
create trigger help_articles_before_write
  before insert or update on public.help_articles
  for each row execute function public.help_articles_before_write();

alter table public.help_articles enable row level security;

drop policy if exists help_articles_select_published on public.help_articles;
create policy help_articles_select_published
  on public.help_articles for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.help_categories c
      where c.id = help_articles.category_id and c.is_active
    )
  );

grant select on public.help_articles to authenticated;

-- Arama: başlık, özet, içerik, adımlar ve etiketlerde; Türkçe karakter
-- duyarsız. Her kelime ayrı ayrı eşleşmeli (AND). Başlık eşleşmesi
-- sıralamada öne çıkar. SECURITY INVOKER — RLS aynen geçerli, yani
-- taslak/arşiv makaleler asla dönmez.
create or replace function public.search_help_articles(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  slug text,
  title text,
  summary text,
  category_slug text,
  category_title text,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with terms as (
    select array_remove(
      regexp_split_to_array(
        -- LIKE joker karakterleri etkisizleştirilir.
        regexp_replace(public.help_normalize(left(coalesce(p_query, ''), 100)), '[%_\\]', ' ', 'g'),
        '\s+'
      ),
      ''
    ) as words
  )
  select
    a.id,
    a.slug,
    a.title,
    a.summary,
    c.slug as category_slug,
    c.title as category_title,
    (
      (select count(*) from unnest(t.words) w where public.help_normalize(a.title) like '%' || w || '%')::int * 10
      + (select count(*) from unnest(t.words) w where public.help_normalize(array_to_string(a.tags, ' ')) like '%' || w || '%')::int * 4
      + case when a.is_faq then 1 else 0 end
    ) as rank
  from public.help_articles a
  join public.help_categories c on c.id = a.category_id
  cross join terms t
  where cardinality(t.words) > 0
    and a.status = 'published'
    and not exists (
      select 1 from unnest(t.words) w where a.search_text not like '%' || w || '%'
    )
  order by rank desc, a.sort_order, a.title
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_help_articles(text, integer) from public;
grant execute on function public.search_help_articles(text, integer) to authenticated;

-- ─────────────────────────────────────────────
-- 3) Makale geri bildirimi ("Bu makale sorunu çözdü mü?")
-- ─────────────────────────────────────────────
create table if not exists public.help_article_feedback (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.help_articles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  helpful boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, user_id)
);

comment on table public.help_article_feedback is
  'Kullanıcı başına makale başına TEK geri bildirim (evet/hayır). '
  'Kullanıcı yalnızca kendi geri bildirimini görebilir/değiştirebilir.';

drop trigger if exists help_article_feedback_set_updated_at on public.help_article_feedback;
create trigger help_article_feedback_set_updated_at
  before update on public.help_article_feedback
  for each row execute function public.set_updated_at();

alter table public.help_article_feedback enable row level security;

drop policy if exists help_article_feedback_select_own on public.help_article_feedback;
create policy help_article_feedback_select_own
  on public.help_article_feedback for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists help_article_feedback_insert_own on public.help_article_feedback;
create policy help_article_feedback_insert_own
  on public.help_article_feedback for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.help_articles a where a.id = article_id and a.status = 'published')
  );

drop policy if exists help_article_feedback_update_own on public.help_article_feedback;
create policy help_article_feedback_update_own
  on public.help_article_feedback for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.help_article_feedback to authenticated;

-- ─────────────────────────────────────────────
-- 4) Destek talepleri
-- ─────────────────────────────────────────────
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- Kullanıcıya gösterilen kısa numara (#1024 gibi).
  ticket_number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'account', 'payment', 'data', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 140),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  screen text check (char_length(screen) <= 120),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'answered', 'awaiting_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  related_article_id uuid references public.help_articles (id) on delete set null,
  -- Yalnızca alan TÜRÜ — alan/defter kimliği BİLİNÇLİ OLARAK saklanmaz.
  space_type text check (space_type in ('home', 'business')),
  -- Uygulama sürümü, ortam, tarayıcı gibi teknik bağlam (hassas veri yok).
  app_context jsonb not null default '{}'::jsonb check (jsonb_typeof(app_context) = 'object'),
  -- Çift tıklama/yeniden gönderimde mükerrer kaydı engeller.
  client_request_id uuid not null unique,
  last_message_at timestamptz not null default now(),
  last_admin_reply_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_tickets is
  'Destek talepleri. Kullanıcı yalnızca kendi taleplerini görebilir ve '
  'oluşturabilir; durum/öncelik değişikliği yalnızca admin (service_role) '
  'veya sistem trigger''ları ile yapılır.';

create index if not exists support_tickets_user_idx on public.support_tickets (user_id, last_message_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_message_at desc);
create index if not exists support_tickets_type_idx on public.support_tickets (type, created_at desc);

-- Öncelik SİSTEM tarafından belirlenir — kullanıcının gönderdiği değer
-- ne olursa olsun ezilir. Yeni talep her zaman 'open' başlar.
create or replace function public.support_tickets_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.status := 'open';
  new.priority := case new.type
    when 'payment' then 'high'
    when 'account' then 'high'
    when 'data' then 'high'
    when 'bug' then 'normal'
    when 'feature' then 'low'
    else 'normal'
  end;
  new.last_message_at := now();
  new.last_admin_reply_at := null;
  new.resolved_at := null;
  new.closed_at := null;
  new.subject := btrim(new.subject);
  new.description := btrim(new.description);
  return new;
end;
$$;

drop trigger if exists support_tickets_before_insert on public.support_tickets;
create trigger support_tickets_before_insert
  before insert on public.support_tickets
  for each row execute function public.support_tickets_before_insert();

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own
  on public.support_tickets for insert
  to authenticated
  with check (user_id = auth.uid());

-- UPDATE/DELETE politikası ve yetkisi BİLİNÇLİ OLARAK YOKTUR.
grant select, insert on public.support_tickets to authenticated;

-- ─────────────────────────────────────────────
-- 5) Destek mesajları
-- ─────────────────────────────────────────────
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  author_role text not null check (author_role in ('user', 'admin')),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  -- Admin iç notu — kullanıcıya ASLA görünmez (RLS).
  is_internal boolean not null default false,
  client_request_id uuid unique,
  created_at timestamptz not null default now(),
  check (not is_internal or author_role = 'admin')
);

comment on table public.support_messages is
  'Destek talebi mesajları. Kullanıcı yalnızca kendi talebindeki iç not '
  'olmayan mesajları görebilir ve yalnızca author_role=user mesaj ekleyebilir.';

create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

alter table public.support_messages enable row level security;

drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own
  on public.support_messages for select
  to authenticated
  using (
    not is_internal
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists support_messages_insert_own on public.support_messages;
create policy support_messages_insert_own
  on public.support_messages for insert
  to authenticated
  with check (
    author_user_id = auth.uid()
    and author_role = 'user'
    and not is_internal
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'
    )
  );

grant select, insert on public.support_messages to authenticated;

-- ─────────────────────────────────────────────
-- 6) Ekler (ekran görüntüleri)
-- ─────────────────────────────────────────────
create table if not exists public.support_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  message_id uuid references public.support_messages (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  -- Storage yolu: "<user_id>/<ticket_client_request_id>/<dosya>"
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

comment on table public.support_attachments is
  'Destek talebi ekran görüntüleri. Dosyalar PRIVATE "support-attachments" '
  'bucket''ında durur; görüntüleme yalnızca kısa ömürlü imzalı URL ile.';

create index if not exists support_attachments_ticket_idx on public.support_attachments (ticket_id);

alter table public.support_attachments enable row level security;

drop policy if exists support_attachments_select_own on public.support_attachments;
create policy support_attachments_select_own
  on public.support_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = support_attachments.ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists support_attachments_insert_own on public.support_attachments;
create policy support_attachments_insert_own
  on public.support_attachments for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and split_part(storage_path, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

grant select, insert on public.support_attachments to authenticated;

-- Storage bucket — PRIVATE, 5 MB, yalnızca görsel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Kullanıcı yalnızca KENDİ klasörüne yükleyebilir ve kendi klasörünü
-- okuyabilir. UPDATE/DELETE yok (kanıt niteliğindeki görsel sonradan
-- değiştirilemez). Admin, service_role ile imzalı URL üretir.
drop policy if exists support_attachments_storage_insert_own on storage.objects;
create policy support_attachments_storage_insert_own
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists support_attachments_storage_select_own on storage.objects;
create policy support_attachments_storage_select_own
  on storage.objects for select
  to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 7) Destek olay kaydı (audit)
-- ─────────────────────────────────────────────
-- Finansal audit_log (defter bazlı, book_id zorunlu) destek için UYGUN
-- DEĞİLDİR ve DEĞİŞTİRİLMEDİ — destek olayları ayrı bir tabloda tutulur.
create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('user', 'admin', 'system')),
  event text not null check (event in (
    'created', 'user_replied', 'admin_replied', 'internal_note', 'status_changed', 'article_linked'
  )),
  from_status text,
  to_status text,
  detail jsonb,
  created_at timestamptz not null default now()
);

comment on table public.support_ticket_events is
  'Destek talebi olay kaydı (oluşturma, yanıtlar, durum değişiklikleri). '
  'Yalnızca trigger''lar ve service_role yazar; authenticated rolüne hiçbir '
  'politika verilmez.';

create index if not exists support_ticket_events_ticket_idx on public.support_ticket_events (ticket_id, created_at);

alter table public.support_ticket_events enable row level security;
-- Bilinçli olarak: authenticated rolüne HİÇBİR politika/yetki yok.

-- Talep oluşturulunca olay kaydı.
create or replace function public.support_tickets_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_events (ticket_id, actor_user_id, actor_role, event, to_status, detail)
  values (new.id, new.user_id, 'user', 'created', new.status,
          jsonb_build_object('type', new.type, 'priority', new.priority));
  return new;
end;
$$;

drop trigger if exists support_tickets_after_insert on public.support_tickets;
create trigger support_tickets_after_insert
  after insert on public.support_tickets
  for each row execute function public.support_tickets_after_insert();

-- Durum değişikliği olay kaydı + resolved_at/closed_at bakımı.
create or replace function public.support_tickets_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'resolved' and new.resolved_at is null then
      new.resolved_at := now();
    end if;
    if new.status = 'closed' and new.closed_at is null then
      new.closed_at := now();
    end if;
    if new.status not in ('resolved', 'closed') then
      new.resolved_at := null;
      new.closed_at := null;
    end if;
    insert into public.support_ticket_events (ticket_id, actor_user_id, actor_role, event, from_status, to_status)
    values (
      new.id,
      auth.uid(),
      case when auth.uid() is null then 'admin'
           when auth.uid() = new.user_id then 'user'
           else 'admin' end,
      'status_changed',
      old.status,
      new.status
    );
  end if;
  return new;
end;
$$;

drop trigger if exists support_tickets_status_change on public.support_tickets;
create trigger support_tickets_status_change
  before update on public.support_tickets
  for each row execute function public.support_tickets_status_change();

-- Kullanıcı yanıt yazdığında: son mesaj zamanı güncellenir; talep
-- "yanıtlandı/kullanıcı yanıtı bekleniyor/çözüldü" durumundaysa tekrar
-- incelenmek üzere 'open'a döner. SECURITY DEFINER — kullanıcı talebi
-- doğrudan UPDATE edemez, yalnızca bu kontrollü yol vardır.
create or replace function public.support_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_role = 'user' then
    update public.support_tickets
       set last_message_at = now(),
           status = case when status in ('answered', 'awaiting_user', 'resolved') then 'open' else status end
     where id = new.ticket_id;
    insert into public.support_ticket_events (ticket_id, actor_user_id, actor_role, event)
    values (new.ticket_id, new.author_user_id, 'user', 'user_replied');
  end if;
  return new;
end;
$$;

drop trigger if exists support_messages_after_insert on public.support_messages;
create trigger support_messages_after_insert
  after insert on public.support_messages
  for each row execute function public.support_messages_after_insert();

revoke all on function public.support_tickets_after_insert() from public;
revoke all on function public.support_tickets_status_change() from public;
revoke all on function public.support_messages_after_insert() from public;
