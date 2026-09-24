import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Birikim hedefleri veri katmanı (bkz. migration 0067). Okumalar RLS'e
 * tabidir; yazmalar yalnızca RPC'lerle (create/update/archive, katkı
 * ekle/iptal). Katkılar hesap bakiyesini DEĞİŞTİRMEZ.
 */

export type GoalStatus = "active" | "achieved" | "archived";

export interface GoalRow {
  id: string;
  bookId: string;
  name: string;
  targetCents: number;
  savedCents: number;
  currency: string;
  targetDate: string | null;
  status: GoalStatus;
  createdAt: string;
  achievedAt: string | null;
}

export interface GoalContribution {
  id: string;
  amountCents: number;
  note: string | null;
  contributedOn: string;
  status: "active" | "cancelled";
}

type ProgressRow = {
  goal_id: string;
  book_id: string;
  name: string;
  target_cents: number;
  saved_cents: number | string;
  currency: string;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
  achieved_at: string | null;
};

function toGoal(r: ProgressRow): GoalRow {
  return {
    id: r.goal_id,
    bookId: r.book_id,
    name: r.name,
    targetCents: Number(r.target_cents),
    savedCents: Number(r.saved_cents),
    currency: r.currency,
    targetDate: r.target_date,
    status: r.status,
    createdAt: r.created_at,
    achievedAt: r.achieved_at,
  };
}

export async function getGoals(supabase: SupabaseClient, bookId: string): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from("savings_goal_progress")
    .select("goal_id, book_id, name, target_cents, saved_cents, currency, target_date, status, created_at, achieved_at")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const order: Record<GoalStatus, number> = { active: 0, achieved: 1, archived: 2 };
  return (data ?? []).map(toGoal).sort((a, b) => order[a.status] - order[b.status]);
}

export async function getGoal(supabase: SupabaseClient, goalId: string): Promise<GoalRow | null> {
  const { data, error } = await supabase
    .from("savings_goal_progress")
    .select("goal_id, book_id, name, target_cents, saved_cents, currency, target_date, status, created_at, achieved_at")
    .eq("goal_id", goalId)
    .maybeSingle();
  if (error) throw error;
  return data ? toGoal(data as ProgressRow) : null;
}

export async function getGoalContributions(supabase: SupabaseClient, goalId: string): Promise<GoalContribution[]> {
  const { data, error } = await supabase
    .from("savings_goal_contributions")
    .select("id, amount_cents, note, contributed_on, status")
    .eq("goal_id", goalId)
    .order("contributed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    amountCents: Number(r.amount_cents),
    note: r.note,
    contributedOn: r.contributed_on,
    status: r.status as "active" | "cancelled",
  }));
}

export async function getGoalQuota(supabase: SupabaseClient, bookId: string): Promise<{ used: number; limit: number | null } | null> {
  const { data, error } = await supabase.rpc("get_savings_goal_quota", { p_book_id: bookId });
  if (error) return null;
  const r = (data ?? [])[0] as { used: number; goal_limit: number | null } | undefined;
  return r ? { used: r.used, limit: r.goal_limit } : null;
}

/**
 * Hedef tarihine kadar ayda ne kadar ayrılmalı (kalan / kalan ay; en az 1 ay).
 * Tarih yoksa, hedefe ulaşıldıysa veya tarih geçtiyse null.
 */
export function monthlyNeededCents(goal: Pick<GoalRow, "targetCents" | "savedCents" | "targetDate">, today: Date): number | null {
  if (!goal.targetDate) return null;
  const remaining = goal.targetCents - goal.savedCents;
  if (remaining <= 0) return null;
  const [y, m, d] = goal.targetDate.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (target < now) return null;
  // Bu aydan hedef ayına kadar kalan ay sayısı (aynı ay = 1).
  const months = Math.max(1, (y - today.getUTCFullYear()) * 12 + (m - 1 - today.getUTCMonth()));
  return Math.ceil(remaining / months);
}

// ── RPC sarmalayıcıları ──
export function createGoal(supabase: SupabaseClient, p: { bookId: string; name: string; targetCents: number; targetDate: string | null }) {
  return supabase.rpc("create_savings_goal", {
    p_book_id: p.bookId,
    p_name: p.name,
    p_target_cents: p.targetCents,
    p_target_date: p.targetDate,
  });
}

export function updateGoal(supabase: SupabaseClient, p: { goalId: string; name: string; targetCents: number; targetDate: string | null }) {
  return supabase.rpc("update_savings_goal", {
    p_goal_id: p.goalId,
    p_name: p.name,
    p_target_cents: p.targetCents,
    p_target_date: p.targetDate,
  });
}

export function setGoalArchived(supabase: SupabaseClient, goalId: string, archived: boolean) {
  return supabase.rpc("set_savings_goal_archived", { p_goal_id: goalId, p_archived: archived });
}

export function addGoalContribution(supabase: SupabaseClient, p: { goalId: string; amountCents: number; note: string | null; date: string | null }) {
  return supabase.rpc("add_savings_goal_contribution", {
    p_goal_id: p.goalId,
    p_amount_cents: p.amountCents,
    p_note: p.note,
    p_date: p.date,
  });
}

export function cancelGoalContribution(supabase: SupabaseClient, contributionId: string) {
  return supabase.rpc("cancel_savings_goal_contribution", { p_contribution_id: contributionId });
}
