import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plan/limit veri katmanı. Ev Premium kontrolü SAHİP (space.owner_user_id)
 * bazlıdır — has_home_premium() RPC'si zaten bunu doğru şekilde yapıyor
 * (bkz. migration 0052). İşletme aboneliği bu turda henüz aktif değil —
 * dürüstçe "Yakında" gösterilir.
 */

export const HOME_FREE_ACCOUNT_LIMIT = 5;

export interface HomePlanInfo {
  isPremium: boolean;
  accountCount: number;
  accountLimit: number | null; // null = sınırsız (Premium)
}

export async function getHomePlanInfo(
  supabase: SupabaseClient,
  bookId: string,
  ownerUserId: string
): Promise<HomePlanInfo> {
  const [{ data: isPremiumData }, { count }] = await Promise.all([
    supabase.rpc("has_home_premium", { p_owner_user_id: ownerUserId }),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("book_id", bookId),
  ]);

  const isPremium = Boolean(isPremiumData);
  return {
    isPremium,
    accountCount: count ?? 0,
    accountLimit: isPremium ? null : HOME_FREE_ACCOUNT_LIMIT,
  };
}

export interface BusinessLimitUsage {
  key: "accounts" | "monthlyTransactions" | "debts" | "customers" | "suppliers";
  label: string;
  used: number;
  limit: number | null; // null = sınırsız (aktif abonelik)
}

export interface BusinessPlanInfo {
  hasActiveSubscription: boolean;
  limits: BusinessLimitUsage[];
}

/**
 * İşletme aboneliği ALAN BAZLIDIR (space_id) — hangi üye baktığına
 * bakılmaksızın AYNI sonucu döner (bkz. has_business_subscription,
 * migration 0054). Kullanım sayıları gerçek verilerden okunur, hiçbir
 * tahmini/sahte değer YOKTUR.
 */
export async function getBusinessPlanInfo(
  supabase: SupabaseClient,
  spaceId: string,
  bookId: string
): Promise<BusinessPlanInfo> {
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("plan", "business")
    .eq("space_id", spaceId)
    .eq("status", "active")
    .maybeSingle();

  const hasActiveSubscription = Boolean(
    subRow && (!subRow.current_period_end || new Date(subRow.current_period_end) > new Date())
  );

  if (hasActiveSubscription) {
    return {
      hasActiveSubscription: true,
      limits: [
        { key: "accounts", label: "Hesap sayısı", used: 0, limit: null },
        { key: "monthlyTransactions", label: "Aylık işlem", used: 0, limit: null },
        { key: "debts", label: "Borç/alacak", used: 0, limit: null },
        { key: "customers", label: "Müşteri", used: 0, limit: null },
        { key: "suppliers", label: "Tedarikçi", used: 0, limit: null },
      ],
    };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [limitsRow, accounts, debts, customers, suppliers, entries] = await Promise.all([
    supabase.rpc("business_free_limits"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    supabase.from("debts").select("id", { count: "exact", head: true }).eq("book_id", bookId),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("space_id", spaceId),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("space_id", spaceId),
    supabase
      .from("transaction_entries")
      .select("transaction_id, transactions!inner(type, occurred_at)")
      .eq("book_id", bookId)
      .in("transactions.type", ["income", "expense"])
      .gte("transactions.occurred_at", monthStart.toISOString()),
  ]);

  const monthlyTxCount = new Set((entries.data ?? []).map((r) => r.transaction_id)).size;
  const limits = (limitsRow.data ?? {}) as Record<string, number>;

  // Gösterilen sayılar TEK kaynaktan (business_free_limits() RPC'si —
  // migration 0054) okunur; asıl UYGULANAN sınır HER ZAMAN veritabanı
  // trigger'ındadır, burası yalnızca AYNI kaynağı görüntüler.
  return {
    hasActiveSubscription: false,
    limits: [
      { key: "accounts", label: "Hesap sayısı", used: accounts.count ?? 0, limit: limits.accounts ?? null },
      { key: "monthlyTransactions", label: "Aylık işlem", used: monthlyTxCount, limit: limits.monthly_transactions ?? null },
      { key: "debts", label: "Borç/alacak", used: debts.count ?? 0, limit: limits.debts ?? null },
      { key: "customers", label: "Müşteri", used: customers.count ?? 0, limit: limits.customers ?? null },
      { key: "suppliers", label: "Tedarikçi", used: suppliers.count ?? 0, limit: limits.suppliers ?? null },
    ],
  };
}
