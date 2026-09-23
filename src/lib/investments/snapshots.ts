import type { SupabaseClient } from "@supabase/supabase-js";
import { holdingValueCents } from "@/lib/dashboard/investments";
import { zonedIsoDate } from "@/lib/format/tz";

/**
 * Günlük portföy değeri anlık görüntüleri (bkz. migration 0063).
 *
 * Yazma YALNIZCA service_role ile, piyasa fiyatı cron'u tarafından yapılır.
 * Değerleme kuralı computePortfolioTotals ile birebir aynıdır: fiyatı olan
 * varlık fiyat × miktar, fiyatı olmayan varlık maliyet tabanıyla sayılır.
 * Fiyatı hiç olmayan portföyler için de satır yazılır (priced_count = 0) —
 * ekranda bu durum "yalnızca maliyet" olarak dürüstçe belirtilir.
 */

export interface SnapshotPoint {
  date: string; // YYYY-MM-DD
  valueCents: number;
  costBasisCents: number;
  holdingCount: number;
  pricedCount: number;
}

const PAGE = 1000;

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function recordPortfolioSnapshots(
  service: SupabaseClient,
  now: Date = new Date()
): Promise<{ written: number; date: string }> {
  const snapshotDate = zonedIsoDate(now);

  const portfolios = await fetchAll<{ id: string; book_id: string }>((a, b) =>
    service.from("portfolios").select("id, book_id").order("id").range(a, b)
  );
  if (portfolios.length === 0) return { written: 0, date: snapshotDate };
  const bookByPortfolio = new Map(portfolios.map((p) => [p.id, p.book_id]));

  const holdings = await fetchAll<{
    portfolio_id: string;
    asset_symbol: string;
    asset_type: string;
    currency: string;
    quantity: number;
    total_cost_basis_cents: number;
  }>((a, b) =>
    service
      .from("holdings")
      .select("portfolio_id, asset_symbol, asset_type, currency, quantity, total_cost_basis_cents")
      .gt("quantity", 0)
      .order("id")
      .range(a, b)
  );

  const { data: prices, error: priceError } = await service
    .from("market_prices_view")
    .select("symbol, asset_type, currency, price");
  if (priceError) throw priceError;
  const priceMap = new Map<string, number>();
  for (const p of prices ?? []) priceMap.set(`${p.symbol}:${p.asset_type}:${p.currency}`, p.price);

  const byBook = new Map<string, { value: number; cost: number; count: number; priced: number }>();
  for (const h of holdings) {
    const bookId = bookByPortfolio.get(h.portfolio_id);
    if (!bookId) continue;
    const agg = byBook.get(bookId) ?? { value: 0, cost: 0, count: 0, priced: 0 };
    const price = priceMap.get(`${h.asset_symbol}:${h.asset_type}:${h.currency}`);
    agg.cost += h.total_cost_basis_cents;
    agg.count += 1;
    if (typeof price === "number") {
      agg.value += holdingValueCents(price, h.quantity);
      agg.priced += 1;
    } else {
      agg.value += h.total_cost_basis_cents;
    }
    byBook.set(bookId, agg);
  }

  const rows = [...byBook.entries()].map(([bookId, a]) => ({
    book_id: bookId,
    snapshot_date: snapshotDate,
    value_cents: a.value,
    cost_basis_cents: a.cost,
    holding_count: a.count,
    priced_count: a.priced,
  }));
  if (rows.length === 0) return { written: 0, date: snapshotDate };

  // Aynı gün cron tekrar çalışırsa (elle tetikleme vb.) o günün satırı güncellenir.
  const { error } = await service.from("portfolio_value_snapshots").upsert(rows, { onConflict: "book_id,snapshot_date" });
  if (error) throw error;
  return { written: rows.length, date: snapshotDate };
}

/** Kullanıcının oturumuyla (RLS: defter üyesi) son `days` günün görüntüleri. */
export async function getPortfolioSnapshots(supabase: SupabaseClient, bookId: string, days = 180): Promise<SnapshotPoint[]> {
  const since = zonedIsoDate(new Date(Date.now() - days * 86_400_000));
  const { data, error } = await supabase
    .from("portfolio_value_snapshots")
    .select("snapshot_date, value_cents, cost_basis_cents, holding_count, priced_count")
    .eq("book_id", bookId)
    .gte("snapshot_date", since)
    .order("snapshot_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: r.snapshot_date,
    valueCents: r.value_cents,
    costBasisCents: r.cost_basis_cents,
    holdingCount: r.holding_count,
    pricedCount: r.priced_count,
  }));
}
