-- 0022_budgets.sql
-- Amaç: Aylık toplam bütçe ve kategori bazlı bütçeler.
--
-- category_id NULL = TOPLAM (aylık genel) bütçe.
-- category_id dolu = KATEGORİ bazlı bütçe.
--
-- ÇİFT SAYIM / ÇELİŞKİ KURALI (tasarım kararı — dokümante edilmiştir):
-- Toplam bütçe ile kategori bütçeleri BİRBİRİNDEN BAĞIMSIZ, örtüşen
-- ölçümlerdir. Toplam bütçenin kullanılan tutarı, kategori bütçelerinin
-- toplamından TÜRETİLMEZ — her ikisi de aynı ledger'dan (transaction_entries)
-- AYRI AYRI hesaplanır:
--   - Toplam bütçe: o ay, o defterdeki TÜM aktif gider entry'lerinin toplamı.
--   - Kategori bütçesi: o ay, o defterde YALNIZCA o kategoriye ait aktif
--     gider entry'lerinin toplamı.
-- Bu "double counting" DEĞİLDİR çünkü tek bir birleşik sayı asla üretilmez;
-- her budget satırının "used" değeri bağımsız bir sorgu sonucudur. UYGULAMA
-- KATMANI, bir defterin kategori bütçelerini toplayıp toplam bütçeyle
-- karşılaştırmamalı veya "toplam - Σkategori = kalan genel bütçe" gibi bir
-- aritmetik YAPMAMALIDIR — bu ikisi farklı şeyleri ölçer, birbirini
-- tamamlayan parçalar değildir.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete restrict,
  category_id uuid references public.categories (id) on delete restrict,
  period_month date not null, -- her zaman ayın 1'ine normalize edilir
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

comment on table public.budgets is
  'Aylık bütçe. category_id NULL ise toplam (genel) bütçe, doluysa kategori '
  'bazlı bütçedir. period_month her zaman ayın 1. gününe normalize edilmiş '
  'olarak saklanır. Fiziksel olarak SİLİNMEZ, yalnızca status=cancelled olur.';

-- KURAL: Aynı book+kategori+ay için çakışan (aktif) bütçe oluşturulamaz.
-- İki ayrı partial unique index gerekiyor çünkü category_id NULL olduğunda
-- standart UNIQUE kısıtı NULL'ları "farklı" sayar (birden fazla toplam
-- bütçeye izin verirdi) — bu yüzden toplam bütçe için ayrı bir kısıt şart.
create unique index budgets_category_unique
  on public.budgets (book_id, category_id, period_month)
  where status = 'active' and category_id is not null;

create unique index budgets_total_unique
  on public.budgets (book_id, period_month)
  where status = 'active' and category_id is null;

create index budgets_book_id_idx on public.budgets (book_id, period_month) where status = 'active';

-- book_id/category_id/period_month sabittir (kapsamı değiştirmek için
-- iptal edip yeni bütçe oluşturulmalı); status yalnızca active->cancelled
-- yönünde değişebilir, tersi yasak.
create or replace function public.enforce_budget_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.book_id <> old.book_id
     or new.category_id is distinct from old.category_id
     or new.period_month <> old.period_month
  then
    raise exception 'budgets.book_id, category_id ve period_month degistirilemez';
  end if;

  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Iptal edilmis bir butce yeniden aktif hale getirilemez';
  end if;

  return new;
end;
$$;

create trigger budgets_enforce_immutable_fields
  before update on public.budgets
  for each row execute function public.enforce_budget_immutable_fields();

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- GÜVENLİK AĞI (defense in depth): category_id doluysa, o kategori ya
-- global (book_id NULL) ya da AYNI book'a ait olmalı. Yazma yüzeyi zaten
-- tamamen fonksiyonlarla kontrol edildiği için bu normalde fonksiyon
-- içinde de kontrol edilir; bu trigger, ileride bir hata/bypass olursa
-- diye ikinci bir güvenlik katmanıdır.
create or replace function public.enforce_budget_category_book_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_book_id uuid;
begin
  if new.category_id is not null then
    select book_id into v_category_book_id
    from public.categories
    where id = new.category_id;

    if not found then
      raise exception 'Kategori bulunamadi (id=%)', new.category_id;
    end if;

    if v_category_book_id is not null and v_category_book_id <> new.book_id then
      raise exception 'Bu kategori baska bir deftere ait, bu butcede kullanilamaz';
    end if;
  end if;

  return new;
end;
$$;

create trigger budgets_enforce_category_book_match
  before insert or update on public.budgets
  for each row execute function public.enforce_budget_category_book_match();
