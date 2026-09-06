import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvestmentSellForm } from "@/components/investments/InvestmentSellForm";
import { getAccountsForBook } from "@/lib/dashboard/formData";
import { getPortfolioForBook, getHoldings } from "@/lib/dashboard/investments";

export default async function InvestmentSellPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/investments?space=${space}` : "/investments";
  if (!bookId) redirect(homeHref);

  const portfolio = await getPortfolioForBook(supabase, bookId);
  if (!portfolio) redirect(homeHref);

  const [accounts, holdings] = await Promise.all([
    getAccountsForBook(supabase, bookId),
    getHoldings(supabase, bookId),
  ]);

  return <InvestmentSellForm portfolioId={portfolio.id} homeHref={homeHref} holdings={holdings} accounts={accounts} />;
}
