import type { SupabaseClient } from "@supabase/supabase-js";
import { getPeriodRange, type DashboardPeriod } from "@/lib/format/date";

/**
 * TÜM fonksiyonlar, ÇAĞIRANIN kendi oturumlu Supabase client'ını
 * (src/lib/supabase/server.ts) kullanır — service_role YOK, ekstra bir
 * "yetki kontrolü" kodu da YOK, çünkü asıl yetkilendirme zaten her
 * tablonun/view'ın RLS politikasındadır (bu projenin baştan beri
 * kurduğu ilke). Bir kullanıcı kendi book_id'si olmayan bir defter için
 * bu fonksiyonları çağırırsa, RLS sonucu her zaman BOŞ döner — hata değil,
 * sessiz güvenli varsayılan.
 *
 * Her fonksiyon BAĞIMSIZ olarak try/catch ile sarmalanmak üzere
 * tasarlanmıştır (çağıran tarafta) — bir kartın verisi çekilemezse diğer
 * kartlar etkilenmemelidir.
 */

export interface CurrencyAmount {
  currency: string;
  cents: number;
}

export interface DebtSummaryRow {
  debtId: string;
  counterpartyName: string;
  direction: "payable" | "receivable";
  dueDate: string | null;
  remainingCents: number;
  status: string;
}

export interface RecentTransactionRow {
  entryId: string;
  type: "income" | "expense" | "transfer";
  amountCents: number;
  currency: string;
  note: string | null;
  occurredAt: string;
  accountName: string | null;
}

export interface BudgetSummary {
  budgetCents: number;
  usedCents: number;
  percentUsed: number;
  alertLevel: "ok" | "warning_80" | "exceeded";
}

export interface PortfolioSummaryRow {
  currency: string;
  totalCostBasisCents: number;
  realizedGainCents: number;
  holdingCount: number;
}

/** Bir defterin tüm (arşivlenmemiş) hesaplarının, para birimine göre toplam bakiyesi. */
export async function getTotalBalanceByCurrency(
  supabase: SupabaseClient,
  bookId: string
): Promise<CurrencyAmount[]> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("currency, balance_cents")
    .eq("book_id", bookId)
    .eq("is_archived", false);

  if (error) throw error;

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.balance_cents);
  }
  return Array.from(totals.entries()).map(([currency, cents]) => ({ currency, cents }));
}

/**
 * Seçilen zaman aralığındaki (Bugün/Bu hafta/Bu ay/Bu yıl) gelir ve
 * gider toplamlarını (para birimine göre) döner. Hesaplama occurred_at
 * üzerinden yapılır; yalnızca AKTİF işlemler dahildir (status='active'
 * — iptal edilenler hariç, mevcut kural DEĞİŞMEDİ).
 */
export async function getFlowForPeriod(
  supabase: SupabaseClient,
  bookId: string,
  period: DashboardPeriod = "month"
): Promise<{ income: CurrencyAmount[]; expense: CurrencyAmount[] }> {
  const { start, end } = getPeriodRange(period);

  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, currency, transactions!inner(type, status, occurred_at)")
    .eq("book_id", bookId)
    .eq("transactions.status", "active")
    .in("transactions.type", ["income", "expense"])
    .gte("transactions.occurred_at", start)
    .lt("transactions.occurred_at", end);

  if (error) throw error;

  const income = new Map<string, number>();
  const expense = new Map<string, number>();

  for (const row of data ?? []) {
    const tx = Array.isArray(row.transactions) ? row.transactions[0] : row.transactions;
    if (!tx) continue;
    const bucket = tx.type === "income" ? income : expense;
    bucket.set(row.currency, (bucket.get(row.currency) ?? 0) + Math.abs(row.amount_cents));
  }

  return {
    income: Array.from(income.entries()).map(([currency, cents]) => ({ currency, cents })),
    expense: Array.from(expense.entries()).map(([currency, cents]) => ({ currency, cents })),
  };
}

/** Bu ay için TOPLAM (kategorisiz) bütçe özetini döner; bütçe yoksa null. */
export async function getTotalBudgetSummary(
  supabase: SupabaseClient,
  bookId: string
): Promise<BudgetSummary | null> {
  // KÖK NEDEN DÜZELTMESİ: getCurrentMonthRange() sunucunun YEREL saat
  // dilimini (üretimde genelde UTC) kullanıyordu — Europe/Istanbul'da ay
  // başındaki ilk birkaç saatte (TR yerel saatiyle 00:00-03:00 arası)
  // sunucu UTC'ye göre HÂLÂ bir önceki ayda olduğundan, bütçe kartı
  // YANLIŞ (önceki ayın) bütçesini arıyordu. Bütçeler ayın 1'ine
  // normalize edilerek saklandığından (bkz. 0022), "bugün" burada
  // AÇIKÇA Europe/Istanbul'a göre hesaplanır.
  const now = new Date();
  const istanbulNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }));
  const periodMonth = `${istanbulNow.getFullYear()}-${String(istanbulNow.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("budget_usage")
    .select("budget_cents, used_cents, percent_used, alert_level")
    .eq("book_id", bookId)
    .is("category_id", null)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    budgetCents: data.budget_cents,
    usedCents: data.used_cents,
    percentUsed: data.percent_used,
    alertLevel: data.alert_level,
  };
}

/**
 * Vadesi yaklaşan (veya gecikmiş) borç/alacakları döner.
 * @param direction verilirse yalnızca o yöndeki kayıtlar (İşletme'nin
 *   "Yaklaşan ödemeler" kartı yalnızca payable ister); verilmezse (Ev
 *   dashboard'u) her iki yön de dahil edilir.
 */
export async function getUpcomingDebts(
  supabase: SupabaseClient,
  bookId: string,
  options: { direction?: "payable" | "receivable"; withinDays?: number; limit?: number } = {}
): Promise<DebtSummaryRow[]> {
  const { direction, withinDays = 30, limit = 5 } = options;
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + withinDays);
  const horizonIso = horizon.toISOString().slice(0, 10);

  let query = supabase
    .from("debt_balances")
    .select("debt_id, counterparty_name, direction, due_date, remaining_cents, status")
    .eq("book_id", bookId)
    .in("status", ["open", "partial"])
    .not("due_date", "is", null)
    .lte("due_date", horizonIso)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (direction) {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    debtId: row.debt_id,
    counterpartyName: row.counterparty_name,
    direction: row.direction,
    dueDate: row.due_date,
    remainingCents: row.remaining_cents,
    status: row.status,
  }));
}

/** Açık/kısmi TÜM alacakların (vade tarihinden bağımsız) toplamı ve sayısı. */
export async function getReceivablesSummary(
  supabase: SupabaseClient,
  bookId: string
): Promise<{ totalCents: number; count: number }> {
  const { data, error } = await supabase
    .from("debt_balances")
    .select("remaining_cents")
    .eq("book_id", bookId)
    .eq("direction", "receivable")
    .in("status", ["open", "partial"]);

  if (error) throw error;

  const rows = data ?? [];
  return {
    totalCents: rows.reduce((sum, r) => sum + r.remaining_cents, 0),
    count: rows.length,
  };
}

/** Son N işlem hareketini (en yeniden eskiye) döner. */
export async function getRecentTransactions(
  supabase: SupabaseClient,
  bookId: string,
  limit = 5
): Promise<RecentTransactionRow[]> {
  const { data, error } = await supabase
    .from("transaction_entries")
    .select(
      "id, amount_cents, currency, note, accounts(name), transactions!inner(type, status, occurred_at)"
    )
    .eq("book_id", bookId)
    .eq("transactions.status", "active")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const tx = Array.isArray(row.transactions) ? row.transactions[0] : row.transactions;
    const account = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
    return {
      entryId: row.id,
      type: tx?.type ?? "transfer",
      amountCents: row.amount_cents,
      currency: row.currency,
      note: row.note,
      occurredAt: tx?.occurred_at ?? new Date().toISOString(),
      accountName: account?.name ?? null,
    };
  });
}

/** Bir defterin portföyündeki aktif (miktar>0) varlıkların para birimine göre özeti. */
export async function getPortfolioSummary(
  supabase: SupabaseClient,
  bookId: string
): Promise<PortfolioSummaryRow[]> {
  const { data: portfolios, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id")
    .eq("book_id", bookId);

  if (portfolioError) throw portfolioError;
  if (!portfolios || portfolios.length === 0) return [];

  const { data: holdings, error: holdingsError } = await supabase
    .from("holdings")
    .select("currency, total_cost_basis_cents, realized_gain_cents, quantity")
    .in(
      "portfolio_id",
      portfolios.map((p) => p.id)
    )
    .gt("quantity", 0);

  if (holdingsError) throw holdingsError;

  const totals = new Map<string, { costBasis: number; realizedGain: number; count: number }>();
  for (const h of holdings ?? []) {
    const existing = totals.get(h.currency) ?? { costBasis: 0, realizedGain: 0, count: 0 };
    existing.costBasis += h.total_cost_basis_cents;
    existing.realizedGain += h.realized_gain_cents;
    existing.count += 1;
    totals.set(h.currency, existing);
  }

  return Array.from(totals.entries()).map(([currency, v]) => ({
    currency,
    totalCostBasisCents: v.costBasis,
    realizedGainCents: v.realizedGain,
    holdingCount: v.count,
  }));
}
