import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Yatırım modülü için piyasa fiyatı önbelleğini (market_prices_cache)
 * günceller — GÜVENLİ (yalnızca service_role yazabilir, bkz. migration
 * 0032/0033) ve `CRON_SECRET` ile korunur (mevcut /api/cron/run-
 * notifications ile AYNI güvenlik deseni).
 *
 * KAPSAM (bu turda bağlanan varlık türleri):
 *  - Döviz (fx): TCMB'nin RESMİ, ücretsiz, anahtarsız günlük kur
 *    servisinden — Türkiye'de bir finans uygulaması için en güvenilir
 *    kaynak budur.
 *  - Kripto (crypto): CoinGecko'nun ücretsiz, anahtarsız public API'si.
 *
 * BAĞLANMAYAN TÜRLER (dürüstçe belirtilir): BIST hisseleri ve gram
 * altın için ücretsiz/güvenilir, anahtarsız bir kaynak bulunamadığından
 * bu turda BAĞLANMADI — bu varlıklar için holdings hâlâ yalnızca
 * maliyet bazlı gösterilmeye devam eder (sahte fiyat ASLA üretilmez).
 *
 * Hem GET hem POST kabul eder: Vercel Cron Jobs bu endpoint'i GET ile
 * çağırır ve `CRON_SECRET` adlı bir environment variable tanımlıysa
 * `Authorization: Bearer <CRON_SECRET>` başlığını OTOMATİK ekler (bkz.
 * Vercel'in "Protect Cron Jobs" özelliği) — elle bir şey yapılandırmaya
 * gerek yoktur. POST, elle (curl/harici zamanlayıcı) test için kalır.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil." }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const results: { symbol: string; assetType: string; ok: boolean; error?: string }[] = [];
  const now = new Date();

  async function upsert(provider: string, symbol: string, assetType: string, currency: string, price: number) {
    try {
      const { error } = await supabase.rpc("upsert_market_price", {
        p_provider: provider,
        p_symbol: symbol,
        p_asset_type: assetType,
        p_currency: currency,
        p_price: price,
        p_fetched_at: now.toISOString(),
      });
      if (error) throw error;
      results.push({ symbol, assetType, ok: true });
    } catch (err) {
      results.push({ symbol, assetType, ok: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  // ── Döviz — TCMB resmi günlük kur XML'i ──
  try {
    const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", { cache: "no-store" });
    if (!res.ok) throw new Error(`TCMB yanıt vermedi: ${res.status}`);
    const xml = await res.text();

    for (const code of ["USD", "EUR"]) {
      // ForexSelling (satış kuru) — TCMB'nin XML'inde <Currency Kod="USD">...<ForexSelling>xx.xx</ForexSelling></Currency>
      const currencyBlockMatch = xml.match(new RegExp(`<Currency[^>]*Kod="${code}"[\\s\\S]*?</Currency>`));
      const sellingMatch = currencyBlockMatch?.[0]?.match(/<ForexSelling>([\d.,]+)<\/ForexSelling>/);
      const priceStr = sellingMatch?.[1]?.replace(",", ".");
      const price = priceStr ? Number(priceStr) : NaN;
      if (!Number.isNaN(price) && price > 0) {
        await upsert("tcmb", code, "fx", "TRY", price);
      } else {
        results.push({ symbol: code, assetType: "fx", ok: false, error: "TCMB XML'inde bulunamadı." });
      }
    }
  } catch (err) {
    results.push({ symbol: "USD/EUR", assetType: "fx", ok: false, error: err instanceof Error ? err.message : "TCMB hatası" });
  }

  // ── Kripto — CoinGecko ücretsiz public API ──
  try {
    const ids = { bitcoin: "BTC", ethereum: "ETH" };
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${Object.keys(ids).join(",")}&vs_currencies=try`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`CoinGecko yanıt vermedi: ${res.status}`);
    const data: Record<string, { try: number }> = await res.json();

    for (const [id, symbol] of Object.entries(ids)) {
      const price = data[id]?.try;
      if (typeof price === "number" && price > 0) {
        await upsert("coingecko", symbol, "crypto", "TRY", price);
      } else {
        results.push({ symbol, assetType: "crypto", ok: false, error: "CoinGecko yanıtında bulunamadı." });
      }
    }
  } catch (err) {
    results.push({ symbol: "BTC/ETH", assetType: "crypto", ok: false, error: err instanceof Error ? err.message : "CoinGecko hatası" });
  }

  const successCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ updated: successCount, total: results.length, results });
}
