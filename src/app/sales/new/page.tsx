import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SaleForm } from "@/components/business/SaleForm";
import { getAccountsForBook, getCategoriesForBook } from "@/lib/dashboard/formData";
import { getCustomers } from "@/lib/dashboard/customers";

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ book_id?: string; space?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/home?space=${space}` : "/home";

  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id, space_id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  const [accounts, categories, customers] = await Promise.all([
    getAccountsForBook(supabase, bookId),
    getCategoriesForBook(supabase, bookId, "income"),
    getCustomers(supabase, book.space_id, { archived: false }),
  ]);

  return <SaleForm bookId={bookId} homeHref={homeHref} accounts={accounts} categories={categories} customers={customers} />;
}
