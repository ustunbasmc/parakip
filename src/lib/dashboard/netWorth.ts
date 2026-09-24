import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Net değer = hesaplar + yatırımlar + bekleyen alacaklar − bekleyen borçlar.
 * Hesap veritabanında (compute_net_worth, migration 0068) yapılır; günlük
 * geçmiş (net_worth_snapshots) AYNI fonksiyondan yazılır. Döviz güncel
 * TCMB kuruyla TL'ye çevrilir; kuru olmayanlar `unconverted`'da döner.
 */

export interface NetWorth {
  accountsCents: number;
  investmentsCents: number;
  receivablesCents: number;
  payablesCents: number;
  netCents: number;
  unconverted: { kind: "account" | "investment"; currency: string; cents: number }[];
}

export interface NetWorthPoint {
  date: string;
  netCents: number;
  assetsCents: number;
  payablesCents: number;
}

export async function getNetWorth(supabase: SupabaseClient, bookId: string): Promise<NetWorth> {
  const { data, error } = await supabase.rpc("compute_net_worth", { p_book_id: bookId });
  if (error) throw error;
  const r = (data ?? [])[0];
  if (!r) return { accountsCents: 0, investmentsCents: 0, receivablesCents: 0, payablesCents: 0, netCents: 0, unconverted: [] };
  return {
    accountsCents: Number(r.accounts_cents),
    investmentsCents: Number(r.investments_cents),
    receivablesCents: Number(r.receivables_cents),
    payablesCents: Number(r.payables_cents),
    netCents: Number(r.net_cents),
    unconverted: (r.unconverted ?? []).map((u: { kind: "account" | "investment"; currency: string; cents: number | string }) => ({
      kind: u.kind,
      currency: u.currency,
      cents: Number(u.cents),
    })),
  };
}

export async function getNetWorthHistory(supabase: SupabaseClient, bookId: string, sinceIso: string): Promise<NetWorthPoint[]> {
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("snapshot_date, net_cents, accounts_cents, investments_cents, receivables_cents, payables_cents")
    .eq("book_id", bookId)
    .gte("snapshot_date", sinceIso)
    .order("snapshot_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    date: r.snapshot_date,
    netCents: Number(r.net_cents),
    assetsCents: Number(r.accounts_cents) + Number(r.investments_cents) + Number(r.receivables_cents),
    payablesCents: Number(r.payables_cents),
  }));
}
