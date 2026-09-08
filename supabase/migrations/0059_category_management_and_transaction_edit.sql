-- 0059_category_management_and_transaction_edit.sql
-- Amaç: (1) Kullanıcı tanımlı kategori yönetimi (oluştur/düzenle/
-- pasifleştir/kullanılmışsa yeniden atayarak kapat), (2) income/expense
-- işlemlerini düzenleme. SAF EKLEME — mevcut tablolar, RLS politikaları,
-- create_simple_transaction/create_transfer/cancel_transaction akışı ve
-- transactions_enforce_cancel_only trigger'ı HİÇ DEĞİŞTİRİLMEDİ.
--
-- KRİTİK MİMARİ KARAR — "Düzenleme" NASIL ÇALIŞIR:
-- transactions_enforce_cancel_only trigger'ı (0006), transactions
-- tablosunun UPDATE'ini YALNIZCA status: active->cancelled geçişine
-- izin verecek şekilde KASITLI olarak kilitler ("Iptal disinda
-- transactions alanlari guncellenemez"). Bu trigger'ı GEVŞETMEK,
-- "finansal kayıtlar fiziksel silinmez/bozulmaz" ilkesinin UPDATE
-- tarafındaki garantisini ZAYIFLATIR — bu yüzden BOZULMADI.
--
-- Bunun yerine "düzenleme", ATOMİK bir RPC (edit_simple_transaction)
-- içinde şu ADIMLARI TEK bir veritabanı işleminde uygular:
--   1. Eski işlem cancel edilir (mevcut can_cancel_transaction yetki
--      kontrolüyle, mevcut cancel akışıyla BİREBİR aynı kural).
--   2. Yeni işlem, create_simple_transaction ile AYNI mantıkla (kategori-
--      defter eşleşmesi dahil) oluşturulur.
--   3. audit_log'a TEK bir 'updated' kaydı yazılır — eski/yeni tüm
--      alanlar (before/after) izlenebilir.
-- Sonuç: kullanıcı arayüzünde "düzenleme" gibi görünür ve davranır,
-- ama veritabanı seviyesinde HİÇBİR satır asla değiştirilmez/silinmez
-- — yalnızca YENİ satırlar eklenir, ESKİ satır iptal İŞARETLENİR.
--
-- KAPSAM DIŞI (bilinçli): TRANSFER işlemleri bu RPC ile
-- DÜZENLENEMEZ — iki taraflı entry + cross-book gizlilik karmaşıklığı
-- nedeniyle güvenli bir kısmi düzenleme YOKTUR (kullanıcı transferi
-- iptal edip yeniden oluşturmalıdır, arayüz bunu açıkça belirtir).

-- ─────────────────────────────────────────────
-- 1) Kategori şeması genişletmesi
-- ─────────────────────────────────────────────

alter table public.categories add column if not exists is_active boolean not null default true;

comment on column public.categories.is_active is
  'false ise kategori PASİF durumdadır — yeni işlemlerde seçilemez ama '
  'geçmiş işlemlerde GÖRÜNMEYE devam eder (fiziksel silme YOKTUR).';

-- Aynı defter (veya global) içinde, AKTİF kategoriler arasında
-- büyük/küçük harf duyarsız isim tekrarını engeller. Pasif (silinmiş/
-- yeniden adlandırılmış) kategorilerle çakışma SERBESTTİR — kullanıcı
-- "Market" kategorisini pasifleştirip yeni bir "Market" oluşturabilir.
create unique index categories_unique_active_name_per_scope
  on public.categories (coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, lower(trim(name)))
  where is_active;

-- ─────────────────────────────────────────────
-- 2) Kategori UPDATE RLS — yalnızca KENDİ deftere özel (is_custom=true,
-- book_id dolu) kategoriler için, editor+ rolüyle. Global şablon
-- kategoriler (book_id NULL) HİÇBİR kullanıcı tarafından
-- değiştirilemez/pasifleştirilemez (RLS zaten book_id IS NOT NULL
-- şartıyla bunu engeller).
-- ─────────────────────────────────────────────

create policy categories_update_editor_plus
  on public.categories for update
  using (book_id is not null and is_custom and public.has_book_role(book_id, array['owner', 'admin', 'editor']))
  with check (book_id is not null and is_custom and public.has_book_role(book_id, array['owner', 'admin', 'editor']));

grant update on public.categories to authenticated;

-- ─────────────────────────────────────────────
-- 3) audit_log CHECK kısıtlarının genişletilmesi — mevcut satırları
-- ETKİLEMEZ (yalnızca YENİ izin verilen değerler eklenir).
-- ─────────────────────────────────────────────

alter table public.audit_log drop constraint if exists audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('created', 'cancelled', 'updated'));

alter table public.audit_log drop constraint if exists audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('transaction_entry', 'debt', 'debt_payment', 'budget', 'holding_transaction', 'account', 'space', 'category'));
-- ÖNEMLİ: mevcut TÜM değerler (0013/0021/0029/0041/0047'de birikmiş)
-- KORUNDU, yalnızca 'category' EKLENDİ — bu kısıtı yalnızca
-- ('transaction_entry','category') yapmak create_debt_v2/cancel_debt/
-- create_budget/holding işlemleri/archive_account/space yönetimi gibi
-- MEVCUT audit_log yazımlarını KIRARDI (bu hata bu turda test sırasında
-- YAKALANIP DÜZELTİLDİ — bkz. proje raporu).

-- ─────────────────────────────────────────────
-- 4) Kategori RPC'leri
-- ─────────────────────────────────────────────

create or replace function public.create_category(
  p_book_id uuid,
  p_name text,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_category_id uuid;
begin
  if p_kind not in ('income', 'expense') then
    raise exception 'Gecersiz kategori turu: %', p_kind;
  end if;

  if not public.has_book_role(p_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok (book_id=%)', p_book_id;
  end if;

  v_name := trim(p_name);
  if v_name = '' then
    raise exception 'Kategori adi bos olamaz';
  end if;
  if length(v_name) > 40 then
    raise exception 'Kategori adi en fazla 40 karakter olabilir';
  end if;

  insert into public.categories (book_id, name, kind, is_custom)
  values (p_book_id, v_name, p_kind, true)
  returning id into v_category_id;
  -- Ayni isimde AKTIF kategori varsa categories_unique_active_name_per_scope
  -- benzersizlik kisiti burada devreye girer ve anlasilir olmayan bir
  -- Postgres hatasi firlatir; TS katmani bu durumu (23505) yakalayip
  -- kullaniciya "Bu isimde bir kategori zaten var" mesaji gosterir.

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (p_book_id, auth.uid(), 'created', 'category', v_category_id, null,
    jsonb_build_object('name', v_name, 'kind', p_kind));
  -- NOT: audit_log.transaction_id NOT NULL kisitina sahip (0009) —
  -- kategori islemleri bir transaction'a bagli olmadigindan bu deger
  -- NULL birakilamaz; asagida kisit gevsetiliyor.

  return v_category_id;
end;
$$;

comment on function public.create_category is
  'Deftere ozel yeni kategori olusturur. Ad bos olamaz, 40 karakteri '
  'asamaz, ayni kapsamda (defter+tur) AKTIF bir kategoriyle ayni isimde '
  'olamaz (categories_unique_active_name_per_scope kisiti).';

revoke all on function public.create_category(uuid, text, text) from public;
grant execute on function public.create_category(uuid, text, text) to authenticated;

create or replace function public.update_category(
  p_category_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_is_custom boolean;
  v_old_name text;
  v_new_name text;
begin
  select book_id, is_custom, name into v_book_id, v_is_custom, v_old_name
  from public.categories where id = p_category_id;

  if v_book_id is null then
    raise exception 'Sistem/genel kategoriler duzenlenemez';
  end if;
  if not v_is_custom then
    raise exception 'Bu kategori duzenlenemez';
  end if;
  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  v_new_name := trim(p_name);
  if v_new_name = '' then
    raise exception 'Kategori adi bos olamaz';
  end if;
  if length(v_new_name) > 40 then
    raise exception 'Kategori adi en fazla 40 karakter olabilir';
  end if;

  update public.categories set name = v_new_name where id = p_category_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, before, after)
  values (v_book_id, auth.uid(), 'updated', 'category', p_category_id, null,
    jsonb_build_object('name', v_old_name), jsonb_build_object('name', v_new_name));
end;
$$;

comment on function public.update_category is
  'Kategori adini degistirir — GECMIS islemlerde kategori id ayni '
  'kaldigi icin yeni isim OTOMATIK yansir, hicbir islem satiri '
  'DOKUNULMAZ. Yalnizca is_custom=true, deftere ozel kategoriler icin.';

revoke all on function public.update_category(uuid, text) from public;
grant execute on function public.update_category(uuid, text) to authenticated;

create or replace function public.deactivate_category(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_is_custom boolean;
  v_usage_count bigint;
begin
  select book_id, is_custom into v_book_id, v_is_custom
  from public.categories where id = p_category_id;

  if v_book_id is null then
    raise exception 'Sistem/genel kategoriler pasiflestirilemez';
  end if;
  if not v_is_custom then
    raise exception 'Bu kategori pasiflestirilemez';
  end if;
  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  select count(*) into v_usage_count from public.transaction_entries where category_id = p_category_id;
  if v_usage_count > 0 then
    raise exception 'Bu kategori % islemde kullanilmis, dogrudan pasiflestirilemez — once islemleri baska bir kategoriye tasiyin', v_usage_count;
  end if;

  update public.categories set is_active = false where id = p_category_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (v_book_id, auth.uid(), 'updated', 'category', p_category_id, null, jsonb_build_object('is_active', false));
end;
$$;

comment on function public.deactivate_category is
  'HIC KULLANILMAMIS bir kategoriyi pasiflestirir. Kullanilmis '
  'kategoriler icin reassign_category_and_deactivate() kullanilmalidir.';

revoke all on function public.deactivate_category(uuid) from public;
grant execute on function public.deactivate_category(uuid) to authenticated;

create or replace function public.reassign_category_and_deactivate(
  p_category_id uuid,
  p_new_category_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_is_custom boolean;
  v_new_book_id uuid;
  v_moved_count integer;
begin
  select book_id, is_custom into v_book_id, v_is_custom
  from public.categories where id = p_category_id;

  if v_book_id is null then
    raise exception 'Sistem/genel kategoriler icin bu islem yapilamaz';
  end if;
  if not v_is_custom then
    raise exception 'Bu kategori icin bu islem yapilamaz';
  end if;
  if not public.has_book_role(v_book_id, array['owner', 'admin', 'editor']) then
    raise exception 'Bu defter icin yetkiniz yok';
  end if;

  if p_new_category_id is not null then
    select book_id into v_new_book_id from public.categories where id = p_new_category_id;
    if not found then
      raise exception 'Yeni kategori bulunamadi';
    end if;
    if v_new_book_id is not null and v_new_book_id <> v_book_id then
      raise exception 'Yeni kategori baska bir deftere ait olamaz';
    end if;
  end if;

  -- FIZIKSEL SILME YOK: mevcut transaction_entries satirlari SILINMEZ,
  -- yalnizca category_id alanlari YENI kategoriye (veya NULL =
  -- "Kategorisiz") GUNCELLENIR — audit/finansal gecmis TAMAMEN korunur,
  -- bu satirlarin KENDISI hicbir sekilde degismez/kaybolmaz.
  update public.transaction_entries
  set category_id = p_new_category_id
  where category_id = p_category_id;
  get diagnostics v_moved_count = row_count;

  update public.categories set is_active = false where id = p_category_id;

  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, after)
  values (v_book_id, auth.uid(), 'updated', 'category', p_category_id, null,
    jsonb_build_object('is_active', false, 'reassigned_to', p_new_category_id, 'moved_entry_count', v_moved_count));

  return v_moved_count;
end;
$$;

comment on function public.reassign_category_and_deactivate is
  'KULLANILMIS bir kategoriyi pasiflestirmenin GUVENLI yolu: once TUM '
  'transaction_entries.category_id satirlarini yeni kategoriye (veya '
  'NULL = Kategorisiz) TASIR, sonra eski kategoriyi pasiflestirir. '
  'Hicbir islem satiri SILINMEZ, yalnizca category_id alani guncellenir.';

revoke all on function public.reassign_category_and_deactivate(uuid, uuid) from public;
grant execute on function public.reassign_category_and_deactivate(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────
-- 5) audit_log.transaction_id NOT NULL kısıtının gevşetilmesi —
-- kategori işlemleri bir transaction'a bağlı DEĞİLDİR. book_id
-- ZORUNLULUĞU (kullanıcının açık isteği) KORUNUR, yalnızca
-- transaction_id NULLABLE olur.
-- ─────────────────────────────────────────────

alter table public.audit_log alter column transaction_id drop not null;

-- ─────────────────────────────────────────────
-- 6) İşlem düzenleme RPC'si — yalnızca income/expense (transfer HARİÇ,
-- yukarıdaki mimari not).
-- ─────────────────────────────────────────────

create or replace function public.edit_simple_transaction(
  p_old_transaction_id uuid,
  p_account_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_category_id uuid default null,
  p_note text default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_type text;
  v_old_status text;
  v_old_book_id uuid;
  v_old_account_id uuid;
  v_old_amount_cents bigint;
  v_old_category_id uuid;
  v_old_note text;
  v_old_occurred_at timestamptz;
  v_old_metadata jsonb;
  v_final_metadata jsonb;
  v_new_transaction_id uuid;
  v_new_entry_id uuid;
  v_category_book_id uuid;
  v_entry_count integer;
begin
  if p_type not in ('income', 'expense') then
    raise exception 'edit_simple_transaction yalnizca income/expense icindir';
  end if;

  select count(*) into v_entry_count from public.transaction_entries where transaction_id = p_old_transaction_id;
  if v_entry_count <> 1 then
    raise exception 'Bu islem duzenlenemez (transfer veya beklenmeyen yapida)';
  end if;

  select t.type, t.status, t.metadata, te.book_id, te.account_id, te.amount_cents, te.category_id, te.note, t.occurred_at
  into v_old_type, v_old_status, v_old_metadata, v_old_book_id, v_old_account_id, v_old_amount_cents, v_old_category_id, v_old_note, v_old_occurred_at
  from public.transactions t
  join public.transaction_entries te on te.transaction_id = t.id
  where t.id = p_old_transaction_id;

  if not found then
    raise exception 'Islem bulunamadi (id=%)', p_old_transaction_id;
  end if;
  if v_old_type = 'transfer' then
    raise exception 'Transfer islemleri bu fonksiyonla duzenlenemez';
  end if;
  if v_old_status <> 'active' then
    raise exception 'Yalnizca aktif islemler duzenlenebilir (mevcut durum: %)', v_old_status;
  end if;
  if not public.can_cancel_transaction(p_old_transaction_id) then
    raise exception 'Bu islemi duzenleme yetkiniz yok (owner/admin gerekli)';
  end if;

  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'p_amount_cents sifir olamaz';
  end if;
  if p_type = 'income' and p_amount_cents <= 0 then
    raise exception 'income islemlerinde amount_cents pozitif olmalidir';
  end if;
  if p_type = 'expense' and p_amount_cents >= 0 then
    raise exception 'expense islemlerinde amount_cents negatif olmalidir';
  end if;

  if p_category_id is not null then
    select book_id into v_category_book_id from public.categories where id = p_category_id;
    if not found then
      raise exception 'Kategori bulunamadi (id=%)', p_category_id;
    end if;
    if v_category_book_id is not null and v_category_book_id <> v_old_book_id then
      raise exception 'Bu kategori baska bir deftere ait';
    end if;
  end if;

  -- metadata verilmezse ESKI metadata (ör. business_kind) KORUNUR —
  -- düzenleme sırasında "Masraf"/"Satış" gibi sınıflandırmanın
  -- SESSİZCE kaybolmaması için.
  v_final_metadata := coalesce(p_metadata, v_old_metadata);

  -- ADIM 1: eski islemi iptal et (mevcut cancel akisiyla BIREBIR ayni
  -- kural — transactions_enforce_cancel_only trigger'i zaten SADECE bu
  -- geçişe izin veriyor).
  update public.transactions set status = 'cancelled' where id = p_old_transaction_id;

  -- ADIM 2: yeni islemi olustur (create_simple_transaction ile AYNI
  -- mantik, dogrudan burada tekrarlanir — SEC DEFINER fonksiyonlar
  -- birbirini SQL icinden guvenle cagirabilir, ama audit_log'a TEK bir
  -- 'updated' kaydi yazmak icin mantik BURADA tutuldu).
  insert into public.transactions (type, occurred_at, metadata)
  values (p_type, p_occurred_at, v_final_metadata)
  returning id into v_new_transaction_id;

  insert into public.transaction_entries
    (transaction_id, book_id, account_id, amount_cents, category_id, note)
  values
    (v_new_transaction_id, v_old_book_id, p_account_id, p_amount_cents, p_category_id, p_note)
  returning id into v_new_entry_id;

  -- ADIM 3: TEK audit kaydi — eski/yeni TUM alanlar izlenebilir.
  insert into public.audit_log (book_id, actor_user_id, action, entity_type, entity_id, transaction_id, before, after)
  values (
    v_old_book_id, auth.uid(), 'updated', 'transaction_entry', v_new_entry_id, v_new_transaction_id,
    jsonb_build_object(
      'transaction_id', p_old_transaction_id, 'account_id', v_old_account_id, 'amount_cents', v_old_amount_cents,
      'category_id', v_old_category_id, 'note', v_old_note, 'occurred_at', v_old_occurred_at
    ),
    jsonb_build_object(
      'transaction_id', v_new_transaction_id, 'account_id', p_account_id, 'amount_cents', p_amount_cents,
      'category_id', p_category_id, 'note', p_note, 'occurred_at', p_occurred_at
    )
  );

  return v_new_transaction_id;
end;
$$;

comment on function public.edit_simple_transaction is
  'income/expense islemini GUVENLI sekilde "duzenler": eski islemi '
  'iptal eder + yeni islemi (degistirilmis degerlerle) olusturur, TEK '
  'veritabani isleminde atomik. Hicbir satir fiziksel olarak '
  'silinmez/degistirilmez. Yalnizca owner/admin (can_cancel_transaction '
  'ile ayni kural) cagirabilir. Transfer islemleri KAPSAM DISIDIR.';

revoke all on function public.edit_simple_transaction(uuid, uuid, text, bigint, uuid, text, timestamptz, jsonb) from public;
grant execute on function public.edit_simple_transaction(uuid, uuid, text, bigint, uuid, text, timestamptz, jsonb) to authenticated;
