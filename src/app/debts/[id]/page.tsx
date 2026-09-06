import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DebtDetailView } from "@/components/debts/DebtDetailView";
import { getDebtDetail } from "@/lib/dashboard/debts";
import { getAccountsForBook, getUserRoleForBook } from "@/lib/dashboard/formData";

export default async function DebtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { id } = await params;
  const { space } = await searchParams;
  const backHref = space ? `/debts?space=${space}` : "/debts";

  const debt = await getDebtDetail(supabase, id);
  if (!debt) notFound(); // RLS erişimi olmayan bir borç için de bunu döndürür

  const [accounts, role] = await Promise.all([
    getAccountsForBook(supabase, debt.bookId),
    getUserRoleForBook(supabase, debt.bookId),
  ]);
  const canManage = role === "owner" || role === "admin";

  return <DebtDetailView debt={debt} accounts={accounts} canManage={canManage} backHref={backHref} />;
}
