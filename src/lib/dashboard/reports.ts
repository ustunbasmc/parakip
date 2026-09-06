import type { SupabaseClient } from "@supabase/supabase-js";
import { getPeriodRange, type DashboardPeriod } from "@/lib/format/date";
/**
 * Raporlar ekranının veri katmanı. Mevcut sorgu desenlerini (RLS'e tabi,
 * service_role YOK, book_id ile sınırlı) yeniden kullanır — yeni bir
 * view/RPC/migration GEREKTİRMEZ, gruplama JS tarafında yapılır.
 */

export interface CategoryBreakdownRow {
  categoryId: string | null;
  categoryName: string;
  totalCents: number;
}

interface RawEntryForReport {
  amount_cents: number;
  category_id: string | null;
  categories: { name: string } | { name: string }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Seçilen aralıkta, kategoriye göre gruplanmış gider dağılımı (büyükten küçüğe). */
export async function getExpenseByCategory(
  supabase: SupabaseClient,
  bookId: string,
  period: DashboardPeriod
): Promise<CategoryBreakdownRow[]> {
  const { start, end } = getPeriodRange(period);

  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, category_id, categories(name), transactions!inner(type, status, occurred_at)")
    .eq("book_id", bookId)
    .eq("transactions.status", "active")
    .eq("transactions.type", "expense")
    .gte("transactions.occurred_at", start)
    .lt("transactions.occurred_at", end);

  if (error) throw error;

  const totals = new Map<string, { name: string; total: number }>();
  for (const row of (data ?? []) as unknown as RawEntryForReport[]) {
    const category = one(row.categories);
    const key = row.category_id ?? "__none__";
    const name = category?.name ?? "Kategorisiz";
    const existing = totals.get(key) ?? { name, total: 0 };
    existing.total += Math.abs(row.amount_cents);
    totals.set(key, existing);
  }

  return Array.from(totals.entries())
    .map(([categoryId, v]) => ({
      categoryId: categoryId === "__none__" ? null : categoryId,
      categoryName: v.name,
      totalCents: v.total,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface MonthlyTrendRow {
  monthLabel: string; // "Oca 2026"
  monthKey: string; // "2026-01" (sıralama için)
  incomeCents: number;
  expenseCents: number;
}

/** Son `months` ay için gelir/gider trendi (en eskiden en yeniye sıralı). */
export async function getMonthlyTrend(
  supabase: SupabaseClient,
  bookId: string,
  months = 6
): Promise<MonthlyTrendRow[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, transactions!inner(type, status, occurred_at)")
    .eq("book_id", bookId)
    .eq("transactions.status", "active")
    .in("transactions.type", ["income", "expense"])
    .gte("transactions.occurred_at", start.toISOString());

  if (error) throw error;

  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const row of (data ?? []) as unknown as { amount_cents: number; transactions: { type: string; occurred_at: string } | { type: string; occurred_at: string }[] | null }[]) {
    const tx = one(row.transactions);
    if (!tx) continue;
    const d = new Date(tx.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.type === "income") bucket.income += Math.abs(row.amount_cents);
    else bucket.expense += Math.abs(row.amount_cents);
  }

  const MONTH_NAMES = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  return Array.from(buckets.entries()).map(([key, v]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      monthKey: key,
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      incomeCents: v.income,
      expenseCents: v.expense,
    };
  });
}

export interface AccountBalanceReportRow {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceCents: number;
}

/** Hesap bazlı bakiye karşılaştırması — account_balances view'ından, yalnızca aktif hesaplar. */
export async function getAccountBalanceComparison(
  supabase: SupabaseClient,
  bookId: string
): Promise<AccountBalanceReportRow[]> {
  const { data, error } = await supabase
    .from("account_balances")
    .select("account_id, name, type, currency, balance_cents, is_archived")
    .eq("book_id", bookId)
    .eq("is_archived", false)
    .order("balance_cents", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.account_id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    balanceCents: r.balance_cents,
  }));
}

export interface CollectedVsPendingRow {
  collectedCents: number; // tahsil edilen (alacaklardan)
  pendingReceivableCents: number; // bekleyen tahsilat
  paidCents: number; // ödenen (borçlardan)
  pendingPayableCents: number; // bekleyen ödeme
}

/** debt_balances üzerinden tahsil edilen/ödenen ve bekleyen tutarlar. */
export async function getCollectedVsPending(supabase: SupabaseClient, bookId: string): Promise<CollectedVsPendingRow> {
  const { data, error } = await supabase
    .from("debt_balances")
    .select("direction, paid_cents, remaining_cents, status")
    .eq("book_id", bookId)
    .neq("status", "cancelled");

  if (error) throw error;

  let collectedCents = 0;
  let pendingReceivableCents = 0;
  let paidCents = 0;
  let pendingPayableCents = 0;

  for (const row of data ?? []) {
    if (row.direction === "receivable") {
      collectedCents += row.paid_cents;
      pendingReceivableCents += row.remaining_cents;
    } else {
      paidCents += row.paid_cents;
      pendingPayableCents += row.remaining_cents;
    }
  }

  return { collectedCents, pendingReceivableCents, paidCents, pendingPayableCents };
}

export interface RecurringImpactRow {
  id: string;
  counterpartyName: string;
  direction: "payable" | "receivable";
  amountCents: number;
  nextDueDate: string;
}

/** Önümüzdeki 30 gün içinde vadesi gelecek aktif tekrarlayan kurallar (yalnızca ilk oluşumu). */
export async function getRecurringImpactNext30Days(
  supabase: SupabaseClient,
  bookId: string
): Promise<RecurringImpactRow[]> {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("recurring_payment_rules")
    .select("id, counterparty_name, direction, amount_cents, next_due_date")
    .eq("book_id", bookId)
    .eq("is_active", true)
    .lte("next_due_date", horizonIso)
    .order("next_due_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    counterpartyName: r.counterparty_name,
    direction: r.direction as "payable" | "receivable",
    amountCents: r.amount_cents,
    nextDueDate: r.next_due_date,
  }));
}

export type ReportKind = "all" | "sale" | "purchase" | "expense" | "collection" | "payment";

export interface ReportKindSummary {
  totalCents: number;
  count: number;
}

interface EntryWithMeta {
  amount_cents: number;
  transactions: { type: string; status: string; metadata: Record<string, unknown> } | { type: string; status: string; metadata: Record<string, unknown> }[] | null;
}
function oneR<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Sistemsel `metadata.business_kind` (satış/alış/masraf) veya
 * debt_payments (tahsilat/ödeme) alanına göre — NOT önekine ASLA
 * bağlı DEĞİLDİR. kind='all' ise mevcut getFlowForPeriod'a bırakılır
 * (bu fonksiyon çağrılmaz).
 */
export async function getReportKindSummary(
  supabase: SupabaseClient,
  bookId: string,
  period: DashboardPeriod,
  kind: Exclude<ReportKind, "all">
): Promise<ReportKindSummary> {
  const { start, end } = getPeriodRange(period);

  if (kind === "collection" || kind === "payment") {
    const direction = kind === "collection" ? "receivable" : "payable";
    const { data, error } = await supabase
      .from("debt_payments")
      .select("amount_cents, paid_at, status, debts!inner(direction, book_id)")
      .eq("debts.book_id", bookId)
      .eq("debts.direction", direction)
      .eq("status", "active")
      .gte("paid_at", start)
      .lt("paid_at", end);
    if (error) throw error;
    const rows = data ?? [];
    return { totalCents: rows.reduce((s, r) => s + r.amount_cents, 0), count: rows.length };
  }

  const type: "income" | "expense" = kind === "sale" ? "income" : "expense";
  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, transactions!inner(type, status, occurred_at, metadata)")
    .eq("book_id", bookId)
    .eq("transactions.type", type)
    .eq("transactions.status", "active")
    .gte("transactions.occurred_at", start)
    .lt("transactions.occurred_at", end);
  if (error) throw error;

  const matched = ((data ?? []) as unknown as EntryWithMeta[]).filter((r) => oneR(r.transactions)?.metadata?.business_kind === kind);
  return { totalCents: matched.reduce((s, r) => s + Math.abs(r.amount_cents), 0), count: matched.length };
}

/** getExpenseByCategory ile AYNI, ama yalnızca belirli bir business_kind'e ait giderleri kapsar (kategori kırılımı için). */
export async function getExpenseByCategoryForKind(
  supabase: SupabaseClient,
  bookId: string,
  period: DashboardPeriod,
  kind: "purchase" | "expense"
): Promise<CategoryBreakdownRow[]> {
  const { start, end } = getPeriodRange(period);

  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, category_id, categories(name), transactions!inner(type, status, occurred_at, metadata)")
    .eq("book_id", bookId)
    .eq("transactions.type", "expense")
    .eq("transactions.status", "active")
    .gte("transactions.occurred_at", start)
    .lt("transactions.occurred_at", end);

  if (error) throw error;

  const totals = new Map<string, { name: string; total: number }>();
  for (const row of (data ?? []) as unknown as (RawEntryForReport & { transactions: { metadata: Record<string, unknown> } | { metadata: Record<string, unknown> }[] | null })[]) {
    const tx = oneR(row.transactions);
    if (tx?.metadata?.business_kind !== kind) continue;
    const category = one(row.categories);
    const key = row.category_id ?? "__none__";
    const name = category?.name ?? "Kategorisiz";
    const existing = totals.get(key) ?? { name, total: 0 };
    existing.total += Math.abs(row.amount_cents);
    totals.set(key, existing);
  }

  return Array.from(totals.entries())
    .map(([categoryId, v]) => ({ categoryId: categoryId === "__none__" ? null : categoryId, categoryName: v.name, totalCents: v.total }))
    .sort((a, b) => b.totalCents - a.totalCents);
}
