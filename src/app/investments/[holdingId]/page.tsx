import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HoldingDetailView } from "@/components/investments/HoldingDetailView";
import { getHoldingDetail, getHoldingTransactions } from "@/lib/dashboard/investments";
import { getUserRoleForBook } from "@/lib/dashboard/formData";

export default async function HoldingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ holdingId: string }>;
  searchParams: Promise<{ space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { holdingId } = await params;
  const { space } = await searchParams;
  const backHref = space ? `/investments?space=${space}` : "/investments";

  const holding = await getHoldingDetail(supabase, holdingId);
  if (!holding) notFound();

  const [transactions, role] = await Promise.all([
    getHoldingTransactions(supabase, holdingId),
    getUserRoleForBook(supabase, holding.bookId),
  ]);
  const canManage = role === "owner" || role === "admin";

  return <HoldingDetailView holding={holding} transactions={transactions} canManage={canManage} backHref={backHref} />;
}
