/**
 * Plan fiyatları ve ücretsiz plan limitleri — tanıtım sayfası ve plan
 * ekranı AYNI kaynaktan okur.
 *
 * Limitlerin UYGULANDIĞI yer her zaman veritabanıdır; buradaki sayılar
 * yalnızca gösterim içindir ve veritabanındaki değerlerle aynı tutulmalıdır:
 *   - HOME_FREE_ACCOUNT_LIMIT      → enforce_account_limit (0052)
 *   - BUSINESS_FREE_LIMITS         → business_free_limits() (0054)
 *   - FREE_EXTRA_MEMBER_LIMIT      → free_extra_member_limit() (0066)
 *   - FREE_SAVINGS_GOAL_LIMIT      → free_savings_goal_limit() (0067)
 */
import "server-only";

export { HOME_FREE_ACCOUNT_LIMIT } from "@/lib/dashboard/plans";

/** Ücretsiz planda alan sahibi dışında eklenebilecek üye sayısı (bekleyen davetler dahil). */
export const FREE_EXTRA_MEMBER_LIMIT = 1;

/** Ücretsiz planda alan başına aynı anda tutulabilecek (arşivlenmemiş) birikim hedefi. */
export const FREE_SAVINGS_GOAL_LIMIT = 1;

export const BUSINESS_FREE_LIMITS = {
  accounts: 10,
  monthlyTransactions: 150,
  debts: 40,
  customers: 30,
  suppliers: 30,
} as const;

function priceEnvAsNumber(envValue: string | undefined, fallback: number): number {
  const num = Number(envValue);
  return !envValue || Number.isNaN(num) ? fallback : Math.round(num);
}

export interface PlanPrices {
  homeMonthly: number;
  homeYearly: number;
  businessMonthly: number;
  businessYearly: number;
}

/** TL cinsinden fiyatlar (Shopier/havale ile aynı ortam değişkenleri). */
export function getPlanPrices(): PlanPrices {
  return {
    homeMonthly: priceEnvAsNumber(process.env.SHOPIER_HOME_MONTHLY_PRICE_TRY, 99),
    homeYearly: priceEnvAsNumber(process.env.SHOPIER_HOME_YEARLY_PRICE_TRY, 990),
    businessMonthly: priceEnvAsNumber(process.env.SHOPIER_BUSINESS_MONTHLY_PRICE_TRY, 249),
    businessYearly: priceEnvAsNumber(process.env.SHOPIER_BUSINESS_YEARLY_PRICE_TRY, 2490),
  };
}
