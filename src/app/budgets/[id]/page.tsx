import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BudgetDetailView } from "@/components/budgets/BudgetDetailView";
import { getBudgetDetail } from "@/lib/dashboard/budgets";
import { getUserRoleForBook } from "@/lib/dashboard/formData";

export default async function BudgetDetailPage({
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
  const backHref = space ? `/budgets?space=${space}` : "/budgets";

  const budget = await getBudgetDetail(supabase, id);
  if (!budget) notFound();

  const role = await getUserRoleForBook(supabase, budget.bookId);
  const canManage = role === "owner" || role === "admin";

  return <BudgetDetailView budget={budget} canManage={canManage} backHref={backHref} />;
}
