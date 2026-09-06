-- 0032_market_prices_cache.sql
-- Amaç: Sağlayıcıdan bağımsız (adapter) piyasa veri önbelleği.
--
-- "ESKİ FİYAT GÜNCEL GİBİ GÖSTERİLMEMELİ" KURALININ UYGULANMASI:
-- is_stale, STATİK bir sütun olarak SAKLANMAZ — çünkü "eski mi" sorusu
-- HER ZAMAN "şu ana göre" sorulur; yazma anında hesaplanıp saklanan bir
-- boolean, zaman geçtikçe otomatik olarak yanlışlaşırdı (tam da önlemeye
-- çalıştığımız hata). Bunun yerine market_prices_view, is_stale ve
-- age_seconds'ı HER SORGUDA now()'a göre CANLI hesaplar. latency_seconds
-- ise farklı bir şeydir: sağlayıcının o an bildirdiği/veriye içkin gecikme
-- (ör. borsa gerçek zamanlı değilse "15 dakika gecikmeli" gibi bir bilgi)
-- — bu gerçek bir veri noktasıdır ve saklanır.

create table public.market_prices_cache (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  symbol text not null,
  asset_type text not null check (asset_type in ('bist', 'us_stock', 'gold', 'fx', 'crypto')),
  currency text not null,
  price numeric not null check (price > 0),
  fetched_at timestamptz not null,
  latency_seconds integer,
  created_at timestamptz not null default now(),
  unique (provider, symbol, asset_type)
);

comment on table public.market_prices_cache is
  'Sağlayıcıdan bağımsız piyasa fiyat önbelleği. Her (provider, symbol, '
  'asset_type) kombinasyonu için TEK satır tutulur (upsert_market_price ile '
  'güncellenir). is_stale/age_seconds bu tabloda YOK — market_prices_view''da '
  'canlı hesaplanır.';

alter table public.market_prices_cache enable row level security;

-- Piyasa verisi book''a özel değil, herkese açık genel veridir.
create policy market_prices_select_all
  on public.market_prices_cache for select
  using (true);

-- Bilinçli olarak: authenticated rolüne INSERT/UPDATE/DELETE HİÇ
-- verilmiyor. Yazma yalnızca upsert_market_price() üzerinden, yalnızca
-- service_role'e (sunucu tarafı piyasa veri adaptörü) açık.

grant select on public.market_prices_cache to authenticated;

create view public.market_prices_view
  with (security_invoker = true)
as
select
  id,
  provider,
  symbol,
  asset_type,
  currency,
  price,
  fetched_at,
  latency_seconds,
  extract(epoch from (now() - fetched_at))::integer as age_seconds,
  -- Eşik: 15 dakika. Bu değer bir varsayımdır; sağlayıcı/varlık tipine göre
  -- farklılaştırılması gerekirse (ör. kripto için daha kısa bir eşik)
  -- ileride konfigüre edilebilir hale getirilmelidir.
  (now() - fetched_at) > interval '15 minutes' as is_stale
from public.market_prices_cache;

comment on view public.market_prices_view is
  'market_prices_cache''in is_stale/age_seconds ile zenginleştirilmiş hali. '
  'Bu iki alan HER SORGUDA canlı hesaplanır — asla saklanmaz, böylece eski '
  'bir fiyat hiçbir zaman "güncel" gibi görünmez. security_invoker=true, '
  'RLS''in gerçek çağıran kullanıcı bağlamında uygulanmasını garanti eder '
  '(burada tüm satırlar zaten herkese açık olsa da, tutarlılık için).';

grant select on public.market_prices_view to authenticated;
