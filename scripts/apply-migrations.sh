#!/usr/bin/env bash
# Gerçek bir Supabase projesine tüm migration'ları sırayla, tek tek
# uygular. Bu script'i Anthropic'in kod çalıştırma ortamı DEĞİL, sizin
# kendi makineniz veya CI ortamınız çalıştırmalıdır — bu sandbox'ın ağ
# erişimi supabase.co'ya kapalıdır (bkz. proje raporu).
#
# Kullanım:
#   export SUPABASE_DB_URL="postgresql://postgres.xxxx:[SIFRE]@aws-0-xx-xxxx.pooler.supabase.com:5432/postgres"
#   ./scripts/apply-migrations.sh
#
# SUPABASE_DB_URL'i almak için: Supabase Dashboard'da proje ana sayfasındaki
# "Connect" butonuna tıklayın (Project Settings -> Database'de DEĞİL).
# Açılan pencerede "Session pooler" sekmesindeki URI'yi kullanın — "Direct
# connection" varsayılan olarak yalnızca IPv6'dır ve çoğu ev/ofis ağından
# (IPv4) bağlanılamaz.

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "HATA: SUPABASE_DB_URL ortam değişkeni tanımlı değil." >&2
  echo "Supabase Dashboard -> Project Settings -> Database -> Connection string (URI)" >&2
  exit 1
fi

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"

echo "Migration dizini: $MIGRATIONS_DIR"
echo ""

for f in "$MIGRATIONS_DIR"/*.sql; do
  name=$(basename "$f")
  echo "=== $name ==="
  if ! psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; then
    echo ""
    echo "HATA: $name başarısız oldu. Sonraki migration'lar uygulanmadı." >&2
    echo "Önceki migration'lar zaten uygulanmış olabilir — Supabase Dashboard'dan" >&2
    echo "veritabanı durumunu kontrol edin, hatayı düzeltip bu script'i tekrar" >&2
    echo "çalıştırmadan önce migration dosyalarının idempotent olduğundan emin olun." >&2
    exit 1
  fi
  echo ""
done

echo "TÜM MIGRATION'LAR BAŞARIYLA UYGULANDI ($(ls "$MIGRATIONS_DIR"/*.sql | wc -l | tr -d ' ') dosya)."
