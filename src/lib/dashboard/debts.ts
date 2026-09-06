import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Borç/Alacak/Tahsilat/Nakit Akışı ekranlarının veri katmanı. Tüm
 * sorgular RLS'e tabidir (debt_balances/debt_payments/recurring_payment_
 * rules görünürlüğü is_book_member ile sınırlıdır) — ekstra bir kontrole
 * gerek yoktur.
 */

export type DebtDirection = "payable" | "receivable";
export type DebtStatus = "open" | "partial" | "paid" | "cancelled";

export interface DebtRow {
  id: string;
  counterpartyName: string;
  direction: DebtDirection;
  principalCents: number;
  paidCents: number;
  remainingCents: number;
  dueDate: string | null;
  status: DebtStatus;
  note: string | null;
}

function mapDebtRow(r: {
  debt_id: string;
  counterparty_name: string;
  direction: string;
  principal_cents: number;
  paid_cents: number;
  remaining_cents: number;
  due_date: string | null;
  status: string;
  note: string | null;
}): DebtRow {
  return {
    id: r.debt_id,
    counterpartyName: r.counterparty_name,
    direction: r.direction as DebtDirection,
    principalCents: r.principal_cents,
    paidCents: r.paid_cents,
    remainingCents: r.remaining_cents,
    dueDate: r.due_date,
    status: r.status as DebtStatus,
    note: r.note,
  };
}

export interface DebtFilters {
  direction?: DebtDirection;
  status?: DebtStatus | "active"; // "active" = open+partial birlikte
}

export async function getDebts(
  supabase: SupabaseClient,
  bookId: string,
  filters: DebtFilters = {}
): Promise<DebtRow[]> {
  let query = supabase
    .from("debt_balances")
    .select("debt_id, counterparty_name, direction, principal_cents, paid_cents, remaining_cents, due_date, status, note")
    .eq("book_id", bookId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.status === "active") query = query.in("status", ["open", "partial"]);
  else if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDebtRow);
}

export interface DebtPaymentRow {
  id: string;
  amountCents: number;
  paidAt: string;
  status: "active" | "cancelled";
  isExternal: boolean;
  transactionEntryId: string | null;
  cancelledAt: string | null;
}

export interface DebtDetail extends DebtRow {
  bookId: string;
  createdAt: string;
  payments: DebtPaymentRow[];
}

export async function getDebtDetail(supabase: SupabaseClient, debtId: string): Promise<DebtDetail | null> {
  const { data: debt, error: debtError } = await supabase
    .from("debt_balances")
    .select("debt_id, book_id, counterparty_name, direction, principal_cents, paid_cents, remaining_cents, due_date, status, note")
    .eq("debt_id", debtId)
    .maybeSingle();

  if (debtError) throw debtError;
  if (!debt) return null;

  const { data: createdRow } = await supabase.from("debts").select("created_at").eq("id", debtId).maybeSingle();

  const { data: payments, error: paymentsError } = await supabase
    .from("debt_payments")
    .select("id, amount_cents, paid_at, status, is_external, transaction_entry_id, cancelled_at")
    .eq("debt_id", debtId)
    .order("paid_at", { ascending: false });

  if (paymentsError) throw paymentsError;

  return {
    ...mapDebtRow(debt),
    bookId: debt.book_id,
    createdAt: createdRow?.created_at ?? "",
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      amountCents: p.amount_cents,
      paidAt: p.paid_at,
      status: p.status,
      isExternal: p.is_external,
      transactionEntryId: p.transaction_entry_id,
      cancelledAt: p.cancelled_at,
    })),
  };
}

export interface CashFlowSummary {
  totalPayableRemainingCents: number;
  totalReceivableRemainingCents: number;
  netCents: number;
  overdue: DebtRow[];
  upcoming: DebtRow[]; // önümüzdeki 30 gün, vadesi geçmemiş
}

/** Aktif (open/partial) tüm borç/alacakların özeti — nakit akışı ekranı için. */
export async function getCashFlowSummary(supabase: SupabaseClient, bookId: string): Promise<CashFlowSummary> {
  const rows = await getDebts(supabase, bookId, { status: "active" });

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const totalPayableRemainingCents = rows
    .filter((r) => r.direction === "payable")
    .reduce((sum, r) => sum + r.remainingCents, 0);
  const totalReceivableRemainingCents = rows
    .filter((r) => r.direction === "receivable")
    .reduce((sum, r) => sum + r.remainingCents, 0);

  const overdue = rows
    .filter((r) => r.dueDate && r.dueDate < todayIso)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const upcoming = rows
    .filter((r) => r.dueDate && r.dueDate >= todayIso && r.dueDate <= horizonIso)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return {
    totalPayableRemainingCents,
    totalReceivableRemainingCents,
    netCents: totalReceivableRemainingCents - totalPayableRemainingCents,
    overdue,
    upcoming,
  };
}

export interface RecurringRuleRow {
  id: string;
  counterpartyName: string;
  direction: DebtDirection;
  amountCents: number;
  frequency: "weekly" | "monthly";
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextDueDate: string;
  note: string | null;
  isActive: boolean;
}

export async function getRecurringPaymentRules(supabase: SupabaseClient, bookId: string): Promise<RecurringRuleRow[]> {
  const { data, error } = await supabase
    .from("recurring_payment_rules")
    .select("id, counterparty_name, direction, amount_cents, frequency, day_of_month, day_of_week, next_due_date, note, is_active")
    .eq("book_id", bookId)
    .order("next_due_date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    counterpartyName: r.counterparty_name,
    direction: r.direction as DebtDirection,
    amountCents: r.amount_cents,
    frequency: r.frequency as "weekly" | "monthly",
    dayOfMonth: r.day_of_month,
    dayOfWeek: r.day_of_week,
    nextDueDate: r.next_due_date,
    note: r.note,
    isActive: r.is_active,
  }));
}
