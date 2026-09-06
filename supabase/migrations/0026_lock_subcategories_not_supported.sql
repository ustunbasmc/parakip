-- 0026_lock_subcategories_not_supported.sql
-- Amaç: categories.parent_id (alt kategori) özelliği MVP kapsamında
-- DESTEKLENMİYOR. Şema sütunu ileride kullanılmak üzere hazır bırakıldı,
-- ama şu an hiçbir kod yolu (ne bir SECURITY DEFINER fonksiyon ne bir
-- RLS-kontrollü insert) bunu doğru şekilde işlemiyor — bütçe/rapor
-- mantığı alt kategori hiyerarşisini hiç bilmiyor. Kategoriler doğrudan
-- tablo INSERT'i (RLS ile) üzerinden yazıldığı için, bu kısıtlamanın
-- TypeScript/API katmanında değil VERİTABANI SEVİYESİNDE uygulanması
-- gerekiyor — aksi halde biri parent_id dolu bir kategori ekleyebilir ve
-- sessizce yanlış/eksik davranan bir özelliğe güvenmiş olur.

alter table public.categories
  add constraint categories_no_subcategories_yet
  check (parent_id is null);

comment on column public.categories.parent_id is
  'Alt kategori özelliği MVP''de DESTEKLENMİYOR. categories_no_subcategories_yet '
  'kısıtı bu sütunun her zaman NULL olmasını zorunlu kılar. Alt kategori özelliği '
  'ileride eklenecekse: (1) bu kısıtı kaldıran bir migration yazılmalı, (2) '
  'budget_usage view''ındaki kategori eşleştirme mantığı (te.category_id = '
  'b.category_id) alt kategorileri de kapsayacak şekilde güncellenmeli, (3) '
  'döngüsel referans (bir kategorinin kendi alt kategorisi olması) engellenmeli.';
