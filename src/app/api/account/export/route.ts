import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { zonedIsoDate } from "@/lib/format/tz";

/**
 * "Verilerimi indir" (KVKK — veri taşınabilirliği). Oturumdaki kullanıcının
 * kendi istemcisiyle (RLS'e tabi) okunur: yalnızca uygulamada zaten
 * görebildiği veriler dosyaya girer. Tek bir JSON dosyası döner; hiçbir
 * yerde saklanmaz.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 1000;

type Query = { range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };

async function fetchAll(label: string, make: () => Query, errors: string[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) {
      errors.push(`${label}: ${error.message}`);
      return out;
    }
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

function byIds(supabase: SupabaseClient, table: string, select: string, column: string, ids: string[], order = "created_at") {
  return () => supabase.from(table).select(select).in(column, ids).order(order, { ascending: true }) as unknown as Query;
}

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  const errors: string[] = [];
  const own = (table: string, select = "*", column = "user_id") => () =>
    supabase.from(table).select(select).eq(column, user.id).order("created_at", { ascending: true }) as unknown as Query;

  const [profile, preferences, memberships] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("space_members").select("space_id, role, invited_at, accepted_at").eq("user_id", user.id),
  ]);
  const spaceIds = (memberships.data ?? []).map((m) => m.space_id as string);
  const [spaces, books] = spaceIds.length
    ? await Promise.all([
        supabase.from("spaces").select("*").in("id", spaceIds),
        supabase.from("books").select("*").in("space_id", spaceIds),
      ])
    : [{ data: [] }, { data: [] }];
  const bookIds = (books.data ?? []).map((b) => b.id as string);

  const perBook = async (table: string, select = "*", order = "created_at") =>
    bookIds.length ? fetchAll(table, byIds(supabase, table, select, "book_id", bookIds, order), errors) : [];
  const perSpace = async (table: string) =>
    spaceIds.length ? fetchAll(table, byIds(supabase, table, "*", "space_id", spaceIds), errors) : [];

  const [
    accounts,
    categories,
    entries,
    debts,
    budgets,
    goals,
    recurringTransactions,
    recurringPayments,
    portfolios,
    customers,
    suppliers,
    notifications,
    tickets,
  ] = await Promise.all([
    perBook("accounts"),
    perBook("categories"),
    perBook("transaction_entries", "*, transaction:transactions(*)"),
    perBook("debts", "*, payments:debt_payments(*)"),
    perBook("budgets"),
    perBook("savings_goals", "*, contributions:savings_goal_contributions(*)"),
    perBook("recurring_transaction_rules"),
    perBook("recurring_payment_rules"),
    perBook("portfolios", "*, holdings(*, transactions:holding_transactions(*))"),
    perSpace("customers"),
    perSpace("suppliers"),
    fetchAll("notifications", own("notifications", "id, type, title, body, created_at, read_at"), errors),
    fetchAll("support_tickets", own("support_tickets", "*, messages:support_messages(*)"), errors),
  ]);

  const payload = {
    format: "parakip-export",
    version: 1,
    exported_at: new Date().toISOString(),
    note: "Tutarlar kuruş cinsindendir (ör. 12345 = 123,45). Ortak alanlarda diğer üyelerin girdiği kayıtlar da yer alır.",
    user: { id: user.id, email: user.email ?? null },
    profile: profile.data ?? null,
    notification_preferences: preferences.data ?? null,
    memberships: memberships.data ?? [],
    spaces: spaces.data ?? [],
    books: books.data ?? [],
    accounts,
    categories,
    transaction_entries: entries,
    debts,
    budgets,
    savings_goals: goals,
    recurring_transaction_rules: recurringTransactions,
    recurring_payment_rules: recurringPayments,
    portfolios,
    customers,
    suppliers,
    notifications,
    support_tickets: tickets,
    ...(errors.length ? { incomplete: errors } : {}),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="parakip-verilerim-${zonedIsoDate(new Date())}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
