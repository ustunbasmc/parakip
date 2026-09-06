import type { SupabaseClient } from "@supabase/supabase-js";

export interface PartyRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  isArchived: boolean;
  createdAt: string;
}

export interface PartyDetail extends PartyRow {
  totalCents: number; // toplam satış/alış
  paidCents: number; // tahsil edilen/ödenen
  pendingCents: number; // bekleyen
  debts: { id: string; principalCents: number; remainingCents: number; status: string; dueDate: string | null }[];
}

function mapParty(r: { id: string; name: string; phone: string | null; email: string | null; note: string | null; is_archived: boolean; created_at: string }): PartyRow {
  return { id: r.id, name: r.name, phone: r.phone, email: r.email, note: r.note, isArchived: r.is_archived, createdAt: r.created_at };
}

export async function getCustomers(supabase: SupabaseClient, spaceId: string, options: { archived?: boolean } = {}): Promise<PartyRow[]> {
  let query = supabase.from("customers").select("id, name, phone, email, note, is_archived, created_at").eq("space_id", spaceId).order("name");
  if (options.archived !== undefined) query = query.eq("is_archived", options.archived);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapParty);
}

export async function getSuppliers(supabase: SupabaseClient, spaceId: string, options: { archived?: boolean } = {}): Promise<PartyRow[]> {
  let query = supabase.from("suppliers").select("id, name, phone, email, note, is_archived, created_at").eq("space_id", spaceId).order("name");
  if (options.archived !== undefined) query = query.eq("is_archived", options.archived);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapParty);
}

async function getPartyDetail(
  supabase: SupabaseClient,
  table: "customers" | "suppliers",
  fkColumn: "customer_id" | "supplier_id",
  id: string
): Promise<PartyDetail | null> {
  const { data: party, error: partyError } = await supabase
    .from(table)
    .select("id, name, phone, email, note, is_archived, created_at")
    .eq("id", id)
    .maybeSingle();
  if (partyError) throw partyError;
  if (!party) return null;

  const { data: debts, error: debtsError } = await supabase
    .from("debt_balances")
    .select("debt_id, principal_cents, paid_cents, remaining_cents, status, due_date")
    .eq(fkColumn, id);
  if (debtsError) throw debtsError;

  const rows = debts ?? [];
  return {
    ...mapParty(party),
    totalCents: rows.reduce((s, r) => s + r.principal_cents, 0),
    paidCents: rows.reduce((s, r) => s + r.paid_cents, 0),
    pendingCents: rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.remaining_cents, 0),
    debts: rows.map((r) => ({ id: r.debt_id, principalCents: r.principal_cents, remainingCents: r.remaining_cents, status: r.status, dueDate: r.due_date })),
  };
}

export async function getCustomerDetail(supabase: SupabaseClient, id: string) {
  return getPartyDetail(supabase, "customers", "customer_id", id);
}
export async function getSupplierDetail(supabase: SupabaseClient, id: string) {
  return getPartyDetail(supabase, "suppliers", "supplier_id", id);
}
