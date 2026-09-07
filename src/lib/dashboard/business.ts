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

/**
 * İşletme özet kartının seçilebilir dönemleri. Genel dashboard'un
 * `DashboardPeriod` tipinden BİLİNÇLİ olarak AYRIDIR (o tip/bileşen bu
 * turda HİÇ değiştirilmedi) — burada "dün" ve "geçen ay" gibi İşletme'ye
 * özgü ek seçenekler var.
 */
export type BusinessPeriod = "today" | "yesterday" | "week" | "month" | "lastMonth" | "year";

export const BUSINESS_PERIOD_LABELS: Record<BusinessPeriod, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu hafta",
  month: "Bu ay",
  lastMonth: "Geçen ay",
  year: "Bu yıl",
};

function getBusinessPeriodRange(period: BusinessPeriod, now: Date = new Date()): { start: string; end: string } {
  if (period === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getPeriodRange("today", yesterday);
  }
  if (period === "lastMonth") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getPeriodRange("month", lastMonth);
  }
  return getPeriodRange(period, now);
}

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
  /** Seçilen dönem — kartların üst başlığında gösterilir. */
  period: BusinessPeriod;
  periodSalesCents: number;
  periodPurchasesCents: number;
  periodExpenseCents: number;
  grossProfitCents: number;
  /** Bekleyen tahsilat/ödeme ve kasa/banka bakiyesi DÖNEMDEN BAĞIMSIZDIR — bunlar her zaman "şu an itibarıyla" anlık durumu gösterir. */
  pendingReceivableCents: number;
  pendingPayableCents: number;
  cashBalanceCents: number;
  bankBalanceCents: number;
}

/**
 * İşletme dashboard'unun tek seferde çektiği özet — kullanıcının
 * SEÇTİĞİ döneme göre (bkz. BusinessPeriod). "Satış"/"Alış" hem peşin
 * (income/expense entry, metadata ile) hem veresiye/vadeli (debts
 * tablosunda aynı metadata ile açılan borç/alacak) tarafını KAPSAR.
 * "Masraf" yalnızca gerçek gider hareketlerinden hesaplanır. Bekleyen
 * tahsilat/ödeme ve kasa/banka bakiyesi dönemden BAĞIMSIZ, her zaman
 * güncel durumu yansıtır (bir "geçen ay" görünümünde bile "şu an ne
 * kadar param var" sorusuna dürüst cevap verir).
 */
export async function getBusinessSummary(
  supabase: SupabaseClient,
  bookId: string,
  period: BusinessPeriod = "today"
): Promise<BusinessSummary> {
  const { start, end } = getBusinessPeriodRange(period);

  const [
    cashSales, creditSales,
    cashPurchases, creditPurchases,
    expense,
    balances, receivables, payables,
  ] = await Promise.all([
    sumEntriesByBusinessKind(supabase, bookId, "income", "sale", start, end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "receivable", "sale", start, end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "purchase", start, end),
    sumOpenDebtsByBusinessKindInRange(supabase, bookId, "payable", "purchase", start, end),
    sumEntriesByBusinessKind(supabase, bookId, "expense", "expense", start, end),
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

  const periodSalesCents = cashSales + creditSales;
  const periodPurchasesCents = cashPurchases + creditPurchases;

  return {
    period,
    periodSalesCents,
    periodPurchasesCents,
    periodExpenseCents: expense,
    grossProfitCents: periodSalesCents - periodPurchasesCents - expense,
    pendingReceivableCents: (receivables.data ?? []).reduce((s, r) => s + r.remaining_cents, 0),
    pendingPayableCents: (payables.data ?? []).reduce((s, r) => s + r.remaining_cents, 0),
    cashBalanceCents,
    bankBalanceCents,
  };
}

