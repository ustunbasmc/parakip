import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserSpacesBasic, getAccountsWithBalance } from "@/lib/dashboard/formData";
import { getFlowForPeriod, getRecentTransactions } from "@/lib/dashboard/queries";
import { getBudgets } from "@/lib/dashboard/budgets";
import { getDebts } from "@/lib/dashboard/debts";
import { SNAPSHOT_SCHEMA_VERSION, type OfflineSnapshot, type SnapshotSpace } from "./snapshotStore";

const MAX_SPACES = 10;
const RECENT_TX = 30;

/**
 * Çevrimdışı kopyayı, uygulamanın ekranlarda kullandığı AYNI okuma
 * fonksiyonlarıyla ve kullanıcının kendi oturumuyla (RLS) oluşturur —
 * yeni bir hesaplama kuralı yoktur; ekranda ne görünüyorsa kopyada o vardır.
 */
export async function buildOfflineSnapshot(supabase: SupabaseClient, userId: string): Promise<OfflineSnapshot> {
  const spaces = (await getUserSpacesBasic(supabase)).slice(0, MAX_SPACES);

  const built: SnapshotSpace[] = await Promise.all(
    spaces.map(async (space) => {
      const [accounts, transactions, budgets, debts, flow] = await Promise.all([
        getAccountsWithBalance(supabase, space.bookId),
        getRecentTransactions(supabase, space.bookId, RECENT_TX),
        getBudgets(supabase, space.bookId).catch(() => []),
        getDebts(supabase, space.bookId, { status: "active" }).catch(() => []),
        getFlowForPeriod(supabase, space.bookId, "month").catch(() => ({ income: [], expense: [] })),
      ]);
      return {
        id: space.id,
        name: space.name,
        type: space.type,
        accounts: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balanceCents: a.balanceCents,
          isArchived: a.isArchived,
        })),
        transactions: transactions.map((t) => ({
          type: t.type,
          amountCents: t.amountCents,
          currency: t.currency,
          note: t.note,
          occurredAt: t.occurredAt,
          accountName: t.accountName,
        })),
        budgets: budgets.map((b) => ({
          name: b.categoryName ?? "Toplam bütçe",
          budgetCents: b.budgetCents,
          usedCents: b.usedCents,
          percentUsed: b.percentUsed,
          alertLevel: b.alertLevel,
        })),
        debts: debts.map((d) => ({
          counterpartyName: d.counterpartyName,
          direction: d.direction,
          remainingCents: d.remainingCents,
          dueDate: d.dueDate,
        })),
        monthIncome: flow.income,
        monthExpense: flow.expense,
      };
    })
  );

  return { schema: SNAPSHOT_SCHEMA_VERSION, userId, savedAt: new Date().toISOString(), spaces: built };
}
