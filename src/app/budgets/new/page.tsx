import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { getCategoriesForBook } from "@/lib/dashboard/formData";

export default async function NewBudgetPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/budgets?space=${space}` : "/budgets";
  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  const categories = await getCategoriesForBook(supabase, bookId, "expense");

  return <BudgetForm bookId={bookId} homeHref={homeHref} categories={categories} />;
}
