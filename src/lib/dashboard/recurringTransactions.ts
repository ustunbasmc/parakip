import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tekrarlayan gelir/gider kuralları (bkz. migration 0067). Vadesi gelen
 * kural her sabah gerçek bir gelir/gider kaydı üretir; oluşturulduğu gün
 * vadesi gelmişse ilk kayıt hemen oluşur.
 */

export interface RecurringTxRule {
  id: string;
  type: "income" | "expense";
  amountCents: number;
  description: string;
  accountName: string | null;
  categoryName: string | null;
  frequency: "monthly" | "weekly";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextDueDate: string;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  createdBy: string;
}

export const WEEKDAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function describeSchedule(r: Pick<RecurringTxRule, "frequency" | "dayOfMonth" | "dayOfWeek">): string {
  return r.frequency === "monthly" ? `Her ayın ${r.dayOfMonth}. günü` : `Her ${WEEKDAY_LABELS[r.dayOfWeek ?? 0]}`;
}

export async function getRecurringTxRules(supabase: SupabaseClient, bookId: string): Promise<RecurringTxRule[]> {
  const { data, error } = await supabase
    .from("recurring_transaction_rules")
    .select(
      "id, type, amount_cents, description, frequency, day_of_month, day_of_week, next_due_date, is_active, run_count, last_run_at, last_error, created_by, accounts(name), categories(name)"
    )
    .eq("book_id", bookId)
    .order("is_active", { ascending: false })
    .order("next_due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const account = Array.isArray(r.accounts) ? r.accounts[0] : r.accounts;
    const category = Array.isArray(r.categories) ? r.categories[0] : r.categories;
    return {
      id: r.id,
      type: r.type as "income" | "expense",
      amountCents: Number(r.amount_cents),
      description: r.description,
      accountName: account?.name ?? null,
      categoryName: category?.name ?? null,
      frequency: r.frequency as "monthly" | "weekly",
      dayOfMonth: r.day_of_month,
      dayOfWeek: r.day_of_week,
      nextDueDate: r.next_due_date,
      isActive: r.is_active,
      runCount: r.run_count,
      lastRunAt: r.last_run_at,
      lastError: r.last_error,
      createdBy: r.created_by,
    };
  });
}

export function createRecurringTxRule(
  supabase: SupabaseClient,
  p: {
    bookId: string;
    accountId: string;
    categoryId: string | null;
    type: "income" | "expense";
    amountCents: number;
    description: string;
    frequency: "monthly" | "weekly";
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    startDate: string | null;
  }
) {
  return supabase
    .rpc("create_recurring_transaction_rule", {
      p_book_id: p.bookId,
      p_account_id: p.accountId,
      p_category_id: p.categoryId,
      p_type: p.type,
      p_amount_cents: p.amountCents,
      p_description: p.description,
      p_frequency: p.frequency,
      p_day_of_month: p.dayOfMonth,
      p_day_of_week: p.dayOfWeek,
      p_start_date: p.startDate,
    })
    .single<{ rule_id: string; created_now: number }>();
}

export function setRecurringTxRuleActive(supabase: SupabaseClient, ruleId: string, active: boolean) {
  return supabase.rpc("set_recurring_transaction_rule_active", { p_rule_id: ruleId, p_active: active });
}
