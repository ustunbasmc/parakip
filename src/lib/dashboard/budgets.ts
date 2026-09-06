import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Bütçeler modülünün veri katmanı. Mevcut budgets/budget_usage şeması
 * ve create_budget/update_budget/cancel_budget RPC'leri (0022-0025)
 * HİÇ DEĞİŞTİRİLMEDİ — yalnızca okuma sorguları eklendi. "Çift sayım"
 * kuralına uyulur: toplam bütçe ile kategori bütçeleri birbirinden
 * TÜRETİLMEZ, budget_usage view'ından ayrı ayrı okunur (bkz. 0022/0025).
 */

export interface BudgetRow {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  periodMonth: string;
  budgetCents: number;
  usedCents: number;
  percentUsed: number;
  alertLevel: "ok" | "warning_80" | "exceeded";
}

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getBudgets(
  supabase: SupabaseClient,
  bookId: string,
  periodMonth: string = currentMonthIso()
): Promise<BudgetRow[]> {
  const { data, error } = await supabase
    .from("budget_usage")
    .select("budget_id, category_id, period_month, budget_cents, used_cents, percent_used, alert_level, categories(name)")
    .eq("book_id", bookId)
    .eq("period_month", periodMonth);

  if (error) throw error;

  return (data ?? [])
    .map((r) => {
      const category = Array.isArray(r.categories) ? r.categories[0] : r.categories;
      return {
        id: r.budget_id,
        categoryId: r.category_id,
        categoryName: category?.name ?? null,
        periodMonth: r.period_month,
        budgetCents: r.budget_cents,
        usedCents: r.used_cents,
        percentUsed: r.percent_used,
        alertLevel: r.alert_level as BudgetRow["alertLevel"],
      };
    })
    .sort((a, b) => {
      // Toplam bütçe (category_id null) her zaman en üstte.
      if (a.categoryId === null) return -1;
      if (b.categoryId === null) return 1;
      return (a.categoryName ?? "").localeCompare(b.categoryName ?? "");
    });
}

export interface BudgetDetail extends BudgetRow {
  bookId: string;
  createdAt: string;
}

export async function getBudgetDetail(supabase: SupabaseClient, budgetId: string): Promise<BudgetDetail | null> {
  const { data, error } = await supabase
    .from("budget_usage")
    .select("budget_id, book_id, category_id, period_month, budget_cents, used_cents, percent_used, alert_level, categories(name)")
    .eq("budget_id", budgetId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: createdRow } = await supabase.from("budgets").select("created_at").eq("id", budgetId).maybeSingle();
  const category = Array.isArray(data.categories) ? data.categories[0] : data.categories;

  return {
    id: data.budget_id,
    bookId: data.book_id,
    categoryId: data.category_id,
    categoryName: category?.name ?? null,
    periodMonth: data.period_month,
    budgetCents: data.budget_cents,
    usedCents: data.used_cents,
    percentUsed: data.percent_used,
    alertLevel: data.alert_level as BudgetRow["alertLevel"],
    createdAt: createdRow?.created_at ?? "",
  };
}
