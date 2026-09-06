import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Yatırımlar modülünün veri katmanı. Mevcut portfolios/holdings/
 * holding_transactions şeması ve create_investment_buy/sell RPC'leri
 * (0030-0035) HİÇ DEĞİŞTİRİLMEDİ — yalnızca okuma sorguları ve "portföy
 * yoksa oluştur" yardımcı fonksiyonu eklendi.
 *
 * "SAHTE PİYASA DEĞERİ GÖSTERME" kuralı: Güncel değer/kâr-zarar YALNIZCA
 * market_prices_view'da GERÇEKTEN önbelleğe alınmış bir fiyat varsa
 * hesaplanır. Hiçbir adaptör bu tabloyu henüz doldurmadığından (bu turun
 * kapsamı dışında), pratikte çoğu varlık için bu veri YOKTUR — arayüz bu
 * durumda "güncel piyasa değeri mevcut değil" der, ASLA tahmini/uydurma
 * bir fiyat üretmez. Maliyet tabanlı tutarlar (total_cost_basis_cents)
 * HER ZAMAN gerçek ve gösterilir.
 */

const ASSET_TYPE_LABELS: Record<string, string> = {
  bist: "BIST Hisse",
  us_stock: "ABD Hissesi",
  gold: "Altın",
  fx: "Döviz",
  crypto: "Kripto",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type] ?? type;
}

export interface HoldingRow {
  id: string;
  portfolioId: string;
  assetSymbol: string;
  assetType: string;
  currency: string;
  quantity: number;
  totalCostBasisCents: number;
  realizedGainCents: number;
  avgCostPerUnitCents: number;
  currentPrice: number | null; // null = piyasa fiyatı mevcut değil
  currentValueCents: number | null;
  unrealizedGainCents: number | null;
  priceIsStale: boolean;
}

/** Book'un TEK portföyünü döndürür; yoksa null (henüz hiç yatırım yapılmamış). */
export async function getPortfolioForBook(supabase: SupabaseClient, bookId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from("portfolios").select("id, name").eq("book_id", bookId).order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Portföy yoksa (kullanıcı ilk kez alış yapıyor) OLUŞTURUR — RLS zaten
 * editor+ rolüne izin verir (bkz. 0030), ayrı bir RPC gerekmez.
 */
export async function getOrCreatePortfolioForBook(supabase: SupabaseClient, bookId: string): Promise<string> {
  const existing = await getPortfolioForBook(supabase, bookId);
  if (existing) return existing.id;

  const { data, error } = await supabase.from("portfolios").insert({ book_id: bookId, name: "Portföyüm" }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function getHoldings(supabase: SupabaseClient, bookId: string): Promise<HoldingRow[]> {
  const portfolio = await getPortfolioForBook(supabase, bookId);
  if (!portfolio) return [];

  const { data: holdings, error } = await supabase
    .from("holdings")
    .select("id, portfolio_id, asset_symbol, asset_type, currency, quantity, total_cost_basis_cents, realized_gain_cents")
    .eq("portfolio_id", portfolio.id)
    .gt("quantity", 0)
    .order("total_cost_basis_cents", { ascending: false });

  if (error) throw error;
  if (!holdings || holdings.length === 0) return [];

  const { data: prices } = await supabase
    .from("market_prices_view")
    .select("symbol, asset_type, currency, price, is_stale")
    .in("symbol", holdings.map((h) => h.asset_symbol));

  const priceMap = new Map<string, { price: number; isStale: boolean }>();
  for (const p of prices ?? []) {
    priceMap.set(`${p.symbol}:${p.asset_type}:${p.currency}`, { price: p.price, isStale: p.is_stale });
  }

  return holdings.map((h) => {
    const avgCostPerUnitCents = h.quantity > 0 ? h.total_cost_basis_cents / h.quantity : 0;
    const priceEntry = priceMap.get(`${h.asset_symbol}:${h.asset_type}:${h.currency}`);
    const currentPrice = priceEntry?.price ?? null;
    const currentValueCents = currentPrice !== null ? Math.round(currentPrice * 100 * h.quantity) : null;
    const unrealizedGainCents = currentValueCents !== null ? currentValueCents - h.total_cost_basis_cents : null;

    return {
      id: h.id,
      portfolioId: h.portfolio_id,
      assetSymbol: h.asset_symbol,
      assetType: h.asset_type,
      currency: h.currency,
      quantity: h.quantity,
      totalCostBasisCents: h.total_cost_basis_cents,
      realizedGainCents: h.realized_gain_cents,
      avgCostPerUnitCents,
      currentPrice,
      currentValueCents,
      unrealizedGainCents,
      priceIsStale: priceEntry?.isStale ?? false,
    };
  });
}

export interface HoldingDetail extends HoldingRow {
  bookId: string;
}

export async function getHoldingDetail(supabase: SupabaseClient, holdingId: string): Promise<HoldingDetail | null> {
  const { data: h, error } = await supabase
    .from("holdings")
    .select("id, portfolio_id, asset_symbol, asset_type, currency, quantity, total_cost_basis_cents, realized_gain_cents, portfolios(book_id)")
    .eq("id", holdingId)
    .maybeSingle();

  if (error) throw error;
  if (!h) return null;

  const portfolio = Array.isArray(h.portfolios) ? h.portfolios[0] : h.portfolios;

  const { data: priceRow } = await supabase
    .from("market_prices_view")
    .select("price, is_stale")
    .eq("symbol", h.asset_symbol)
    .eq("asset_type", h.asset_type)
    .eq("currency", h.currency)
    .maybeSingle();

  const avgCostPerUnitCents = h.quantity > 0 ? h.total_cost_basis_cents / h.quantity : 0;
  const currentPrice = priceRow?.price ?? null;
  const currentValueCents = currentPrice !== null ? Math.round(currentPrice * 100 * h.quantity) : null;
  const unrealizedGainCents = currentValueCents !== null ? currentValueCents - h.total_cost_basis_cents : null;

  return {
    id: h.id,
    bookId: portfolio?.book_id ?? "",
    portfolioId: h.portfolio_id,
    assetSymbol: h.asset_symbol,
    assetType: h.asset_type,
    currency: h.currency,
    quantity: h.quantity,
    totalCostBasisCents: h.total_cost_basis_cents,
    realizedGainCents: h.realized_gain_cents,
    avgCostPerUnitCents,
    currentPrice,
    currentValueCents,
    unrealizedGainCents,
    priceIsStale: priceRow?.is_stale ?? false,
  };
}

export interface HoldingTransactionRow {
  id: string;
  type: "buy" | "sell";
  quantity: number;
  priceCents: number;
  occurredAt: string;
  status: "active" | "cancelled";
}

export async function getHoldingTransactions(supabase: SupabaseClient, holdingId: string): Promise<HoldingTransactionRow[]> {
  const { data, error } = await supabase
    .from("holding_transactions")
    .select("id, type, quantity, price_cents, occurred_at, status")
    .eq("holding_id", holdingId)
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    type: r.type as "buy" | "sell",
    quantity: r.quantity,
    priceCents: r.price_cents,
    occurredAt: r.occurred_at,
    status: r.status as "active" | "cancelled",
  }));
}

export interface PortfolioTotals {
  totalCostBasisCents: number;
  totalCurrentValueCents: number | null; // null = hiçbir varlık için fiyat yok
  totalUnrealizedGainCents: number | null;
  totalRealizedGainCents: number;
  holdingCount: number;
  hasAnyPrice: boolean;
}

export function computePortfolioTotals(holdings: HoldingRow[]): PortfolioTotals {
  const hasAnyPrice = holdings.some((h) => h.currentValueCents !== null);
  return {
    totalCostBasisCents: holdings.reduce((s, h) => s + h.totalCostBasisCents, 0),
    totalCurrentValueCents: hasAnyPrice
      ? holdings.reduce((s, h) => s + (h.currentValueCents ?? h.totalCostBasisCents), 0)
      : null,
    totalUnrealizedGainCents: hasAnyPrice
      ? holdings.reduce((s, h) => s + (h.unrealizedGainCents ?? 0), 0)
      : null,
    totalRealizedGainCents: holdings.reduce((s, h) => s + h.realizedGainCents, 0),
    holdingCount: holdings.length,
    hasAnyPrice,
  };
}
