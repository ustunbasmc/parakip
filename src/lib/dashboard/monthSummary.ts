import type { SupabaseClient } from "@supabase/supabase-js";
import { getExpenseByCategory, type CategoryBreakdownRow } from "@/lib/dashboard/reports";
import { getFlowForPeriod, type CurrencyAmount } from "@/lib/dashboard/queries";
import { zonedDate, zonedMidnight } from "@/lib/format/tz";

/**
 * "Bu ayın özeti": ayın başından bugüne harcama, geçen ayın AYNI günlerine
 * göre kıyaslanır (1–24 Eylül ↔ 1–24 Ağustos) — tam ayla kıyaslamak ayın
 * başında hep "daha az harcadın" yanılgısı yaratırdı. Yalnızca TL tutarlar.
 */

export interface MonthSummary {
  daysElapsed: number;
  daysInMonth: number;
  incomeCents: number;
  expenseCents: number;
  prevExpenseCents: number;
  /** Geçen ayın aynı dönemine göre gider değişimi (%); karşılaştırma yoksa null. */
  expenseChangePct: number | null;
  dailyAvgCents: number;
  /** Bu hızla ay sonu tahmini gider. */
  projectedExpenseCents: number;
  /** (gelir − gider) / gelir; gelir yoksa null. */
  savingsRatePct: number | null;
  topCategory: { name: string; cents: number } | null;
  biggestIncrease: { name: string; deltaCents: number } | null;
}

function tryCents(list: CurrencyAmount[]) {
  return list.find((a) => a.currency === "TRY")?.cents ?? 0;
}

export function buildMonthSummary(input: {
  daysElapsed: number;
  daysInMonth: number;
  incomeCents: number;
  expenseCents: number;
  prevExpenseCents: number;
  categories: CategoryBreakdownRow[];
  prevCategories: CategoryBreakdownRow[];
}): MonthSummary {
  const { daysElapsed, daysInMonth, incomeCents, expenseCents, prevExpenseCents } = input;
  const top = [...input.categories].sort((a, b) => b.totalCents - a.totalCents)[0];
  const prevByName = new Map(input.prevCategories.map((c) => [c.categoryName, c.totalCents]));
  let biggest: { name: string; deltaCents: number } | null = null;
  for (const c of input.categories) {
    const delta = c.totalCents - (prevByName.get(c.categoryName) ?? 0);
    if (delta > 0 && (!biggest || delta > biggest.deltaCents)) biggest = { name: c.categoryName, deltaCents: delta };
  }
  const dailyAvg = daysElapsed > 0 ? Math.round(expenseCents / daysElapsed) : 0;
  return {
    daysElapsed,
    daysInMonth,
    incomeCents,
    expenseCents,
    prevExpenseCents,
    expenseChangePct: prevExpenseCents > 0 ? Math.round(((expenseCents - prevExpenseCents) / prevExpenseCents) * 100) : null,
    dailyAvgCents: dailyAvg,
    projectedExpenseCents: dailyAvg * daysInMonth,
    savingsRatePct: incomeCents > 0 ? Math.round(((incomeCents - expenseCents) / incomeCents) * 100) : null,
    topCategory: top && top.totalCents > 0 ? { name: top.categoryName, cents: top.totalCents } : null,
    biggestIncrease: biggest,
  };
}

export async function getMonthSummary(supabase: SupabaseClient, bookId: string, now: Date): Promise<MonthSummary> {
  const z = zonedDate(now);
  const daysInMonth = new Date(Date.UTC(z.year, z.month, 0)).getUTCDate();
  const monthStart = zonedMidnight(z.year, z.month, 1);
  const cur = { start: monthStart.toISOString(), end: now.toISOString() };
  const prevStart = zonedMidnight(z.year, z.month - 1, 1);
  // Geçen ayın aynı gün sayısı (kısa aylarda ay sonunda kesilir).
  const prevDays = new Date(Date.UTC(z.year, z.month - 1, 0)).getUTCDate();
  const prevEnd = new Date(Math.min(prevStart.getTime() + (now.getTime() - monthStart.getTime()), zonedMidnight(z.year, z.month - 1, prevDays + 1).getTime()));
  const prev = { start: prevStart.toISOString(), end: prevEnd.toISOString() };

  const [flow, prevFlow, categories, prevCategories] = await Promise.all([
    getFlowForPeriod(supabase, bookId, "month", cur),
    getFlowForPeriod(supabase, bookId, "month", prev),
    getExpenseByCategory(supabase, bookId, "month", cur),
    getExpenseByCategory(supabase, bookId, "month", prev),
  ]);

  return buildMonthSummary({
    daysElapsed: z.day,
    daysInMonth,
    incomeCents: tryCents(flow.income),
    expenseCents: tryCents(flow.expense),
    prevExpenseCents: tryCents(prevFlow.expense),
    categories,
    prevCategories,
  });
}
