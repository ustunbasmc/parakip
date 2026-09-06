import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvestmentBuyForm } from "@/components/investments/InvestmentBuyForm";
import { getAccountsForBook } from "@/lib/dashboard/formData";
import { getOrCreatePortfolioForBook } from "@/lib/dashboard/investments";

export default async function InvestmentBuyPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/investments?space=${space}` : "/investments";
  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  const [accounts, portfolioId] = await Promise.all([
    getAccountsForBook(supabase, bookId),
    getOrCreatePortfolioForBook(supabase, bookId),
  ]);

  return <InvestmentBuyForm portfolioId={portfolioId} homeHref={homeHref} accounts={accounts} />;
}
