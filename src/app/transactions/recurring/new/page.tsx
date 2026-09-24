import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { RecurringTxForm } from "@/components/transactions/RecurringTxForm";
import { getAccountsForBook, getCategoriesForBook } from "@/lib/dashboard/formData";

export default async function NewRecurringTxPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/transactions/recurring?space=${space}` : "/transactions/recurring";
  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    getAccountsForBook(supabase, bookId),
    getCategoriesForBook(supabase, bookId, "income"),
    getCategoriesForBook(supabase, bookId, "expense"),
  ]);

  return (
    <RecurringTxForm
      bookId={bookId}
      homeHref={homeHref}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      incomeCategories={incomeCategories}
      expenseCategories={expenseCategories}
    />
  );
}
