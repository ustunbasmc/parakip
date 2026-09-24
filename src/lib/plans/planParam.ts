/**
 * Tanıtım sayfasında seçilen planın kayıt → onboarding → ödeme ekranına
 * taşınması (`?plan=`). İstemci ve sunucu tarafında kullanılabilir.
 */

export const PLAN_KEYS = ["home_monthly", "home_yearly", "business_monthly", "business_yearly"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export type PlanSpaceType = "home" | "business";
export type PlanPeriod = "monthly" | "yearly";

export function parsePlanKey(value: string | null | undefined): PlanKey | null {
  return value && (PLAN_KEYS as readonly string[]).includes(value) ? (value as PlanKey) : null;
}

export function parseSpaceType(value: string | null | undefined): PlanSpaceType | null {
  return value === "home" || value === "business" ? value : null;
}

export function planSpaceType(plan: PlanKey): PlanSpaceType {
  return plan.startsWith("business") ? "business" : "home";
}

export function planPeriod(plan: PlanKey): PlanPeriod {
  return plan.endsWith("yearly") ? "yearly" : "monthly";
}

export function planKey(type: PlanSpaceType, period: PlanPeriod): PlanKey {
  return `${type}_${period}` as PlanKey;
}

/**
 * Yıllık planda kaç ay bedava olduğu, fiyatlardan hesaplanır (ör. 990 / 99
 * → 10 ay ödenir, 2 ay bedava). Fiyat değişirse rozet de doğru kalır;
 * kazanç bir aydan azsa 0 döner (rozet gösterilmez).
 */
export function freeMonths(monthly: number, yearly: number): number {
  if (!(monthly > 0) || !(yearly > 0)) return 0;
  return Math.max(0, Math.floor(12 - yearly / monthly + 1e-9));
}

/** Kayıttan sonra gidilecek ilk yol: plan/tür varsa onboarding bunları taşır. */
export function onboardingEntryPath(opts: { plan?: PlanKey | null; type?: PlanSpaceType | null }): string | null {
  if (opts.plan) return `/onboarding/space-type?plan=${opts.plan}`;
  if (opts.type) return `/onboarding/space-type?type=${opts.type}`;
  return null;
}
