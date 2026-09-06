import type { SupabaseClient } from "@supabase/supabase-js";
import { getPeriodRange } from "@/lib/format/date";

/**
 * İşletme Finans Modu'nun veri katmanı. Satış/Alış/Masraf ayrımı ARTIK
 * NOT ÖNEKİNE DEĞİL, transactions.metadata->>'business_kind' (gelir/
 * gider için, sütun 0006'dan beri zaten vardı) ve debts.metadata->>
 * 'business_kind' (borç/alacak için, bkz. migration 0051) SİSTEM
 * ALANINA dayanır. Kullanıcı notu (note) SALT kullanıcı açıklamasıdır,
 * sınıflandırmaya HİÇ karışmaz.
 */

export type BusinessKind = "sale" | "purchase" | "expense";

interface EntryWithTxMeta {
  amount_cents: number;
  transactions: { type: string; status: string; occurred_at: string; metadata: Record<string, unknown> } | { type: string; status: string; occurred_at: string; metadata: Record<string, unknown> }[] | null;
}

function oneTx<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function sumEntriesByBusinessKind(
  supabase: SupabaseClient,
  bookId: string,
  type: "income" | "expense",
  kind: BusinessKind,
  start: string,
  end: string
): Promise<number> {
  // NOT: metadata->>'business_kind' filtresi PostgREST'in EMBEDDED
  // (transactions!inner) kaynak üzerinde JSON operatörüyle güvenilir
  // şekilde çalışıp çalışmadığı belirsiz olduğu için, dönen satırlar
  // burada JS tarafında filtrelenir (transactionHistory.ts'teki yatırım
  // tespiti ile AYNI, kanıtlanmış desen).
  const { data, error } = await supabase
    .from("transaction_entries")
    .select("amount_cents, transactions!inner(type, status, occurred_at, metadata)")
    .eq("book_id", bookId)
    .eq("transactions.type", type)
    .eq("transactions.status", "active")
    .gte("transactions.occurred_at", start)
    .lt("transactions.occurred_at", end);

  if (error) throw error;

  return ((data ?? []) as unknown as EntryWithTxMeta[]).reduce((sum, r) => {
    const tx = oneTx(r.transactions);
    if (tx?.metadata?.business_kind !== kind) return sum;
    return sum + Math.abs(r.amount_cents);
  }, 0);
}

async function sumOpenDebtsByBusinessKindInRange(
  supabase: SupabaseClient,
  bookId: string,
  direction: "payable" | "receivable",
  kind: BusinessKind,
  start: string,
  end: string
): Promise<number> {
  const { data, error } = await supabase
    .from("debts")
    .select("principal_cents, metadata")
    .eq("book_id", bookId)
    .eq("direction", direction)
    .neq("status", "cancelled")
    .gte("created_at", start)
    .lt("created_at", end);

  if (error) throw error;
  return (data ?? [])
    .filter((r) => (r.metadata as Record<string, unknown> | null)?.business_kind === kind)
    .reduce((sum, r) => sum + r.principal_cents, 0);
}

export interface BusinessSummary {
  todaySalesCents: number;
  todayPurchasesCents: number;
  todayExpenseCents: number;
  monthSalesCents: number;
  monthPurchasesCents: number;
  monthExpenseCents: number;
  grossProfitCents: number;
  pendingReceivableCents: number;
  pendingPayableCents: number;
  cashBalanceCents: number;
  bankBalanceCents: number;
}

/**
 * İşletme dashboard'unun tek seferde çektiği özet. "Satış"/"Alış" hem
 * peşin (income/expense entry, metadata ile) hem veresiye/vadeli (debts
 * tablosunda aynı metadata ile açılan borç/alacak) tarafını KAPSAR.
 * "Masraf" yalnızca gerçek gider hareketlerinden (kira, elektrik vb. —
 * genelde peşin ödenir, borç akışı YOK) hesaplanır.
 */
export async function getBusinessSummary(supabase: SupabaseClient, bookId: string): Promise<BusinessSummary> {
  const today = getPeriodRange("today");
  const month = getPeriodRange("month");

  const [
    todayCashSales, todayCreditSales,
    todayCashPurchases, todayCreditPurchases,
    todayExpense,
    monthCashSales, monthCreditSales,
    monthCashPurchases, monthCreditPurchases,
    monthExpense,
    balances, receivables, payables,
  ] = await Promise.all([
    sumEntriesByBusinessKind(supabase, bookId, "income", "sale", today.start, today.end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "receivable", "sale", today.start, today.end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "purchase", today.start, today.end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "payable", "purchase", today.start, today.end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "expense", today.start, today.end),
    sumEntriesByBusinessKind(supabase, bookId, "income", "sale", month.start, month.end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "receivable", "sale", month.start, month.end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "purchase", month.start, month.end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "payable", "purchase", month.start, month.end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "expense", month.start, month.end),
    supabase.from("account_balances").select("type, currency, balance_cents").eq("book_id", bookId).eq("is_archived", false),
    supabase.from("debt_balances").select("remaining_cents").eq("book_id", bookId).eq("direction", "receivable").in("status", ["open", "partial"]),
    supabase.from("debt_balances").select("remaining_cents").eq("book_id", bookId).eq("direction", "payable").in("status", ["open", "partial"]),
  ]);

  if (balances.error) throw balances.error;
  if (receivables.error) throw receivables.error;
  if (payables.error) throw payables.error;

  const cashBalanceCents = (balances.data ?? [])
    .filter((a) => a.type === "cash" && a.currency === "TRY")
    .reduce((sum, a) => sum + a.balance_cents, 0);
  const bankBalanceCents = (balances.data ?? [])
    .filter((a) => a.type === "bank" && a.currency === "TRY")
    .reduce((sum, a) => sum + a.balance_cents, 0);

  const monthSalesCents = monthCashSales + monthCreditSales;
  const monthPurchasesCents = monthCashPurchases + monthCreditPurchases;

  return {
    todaySalesCents: todayCashSales + todayCreditSales,
    todayPurchasesCents: todayCashPurchases + todayCreditPurchases,
    todayExpenseCents: todayExpense,
    monthSalesCents,
    monthPurchasesCents,
    monthExpenseCents: monthExpense,
    grossProfitCents: monthSalesCents - monthPurchasesCents - monthExpense,
    pendingReceivableCents: (receivables.data ?? []).reduce((s, r) => s + r.remaining_cents, 0),
    pendingPayableCents: (payables.data ?? []).reduce((s, r) => s + r.remaining_cents, 0),
    cashBalanceCents,
    bankBalanceCents,
  };
}
