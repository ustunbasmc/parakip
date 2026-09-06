import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountWithBalance, getUserRoleForBook } from "@/lib/dashboard/formData";
import { getTransactionHistory } from "@/lib/dashboard/transactionHistory";
import { AccountDetailView } from "@/components/accounts/AccountDetailView";

export default async function AccountDetailPage({
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
  const homeHref = space ? `/accounts?space=${space}` : "/accounts";

  const account = await getAccountWithBalance(supabase, id);
  if (!account) notFound(); // RLS gercekten erisimi olmayan bir hesap icin de bunu dondurur

  const role = await getUserRoleForBook(supabase, account.bookId);
  const canArchive = role === "owner" || role === "admin";

  // "Iptal durumu" da gorunur olmali diye status:'all' — son 10 islem,
  // aktif VE iptal edilmis, en yeniden eskiye. Bu hesaba ait olmayan/
  // baska bir deftere ait entry'ler RLS + accountId filtresiyle zaten
  // hic sorguya girmez.
  let recentTransactions: Awaited<ReturnType<typeof getTransactionHistory>>["rows"];
  let recentError = false;
  try {
    const result = await getTransactionHistory(supabase, account.bookId, {
      accountId: account.id,
      status: "all",
      limit: 10,
    });
    recentTransactions = result.rows;
  } catch {
    recentError = true;
    recentTransactions = [];
  }

  return (
    <AccountDetailView
      account={account}
      canArchive={canArchive}
      homeHref={homeHref}
      accountsHref={homeHref}
      spaceParam={space ?? ""}
      recentTransactions={recentTransactions}
      recentError={recentError}
      userEmail={user.email ?? ""}
    />
  );
}
