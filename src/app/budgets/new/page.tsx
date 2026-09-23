import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { getCategoriesForBook } from "@/lib/dashboard/formData";
import { getExistingBudgetKeys } from "@/lib/dashboard/budgets";
import { parseMonthParam, shiftMonthIso, zonedMonthIso } from "@/lib/format/tz";

export default async function NewBudgetPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string; month?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { book_id: bookId, space, month } = await searchParams;
  // Geçmiş aylara yeni bütçe açılmaz; yalnızca bu ay ve gelecek ay.
  const current = zonedMonthIso();
  const requested = parseMonthParam(month);
  const periodMonth = requested && requested >= current && requested <= shiftMonthIso(current, 1) ? requested : current;
  const homeParams = new URLSearchParams();
  if (space) homeParams.set("space", space);
  if (periodMonth !== current) homeParams.set("month", periodMonth.slice(0, 7));
  const homeHref = homeParams.size > 0 ? `/budgets?${homeParams}` : "/budgets";
  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  const [categories, existing] = await Promise.all([
    getCategoriesForBook(supabase, bookId, "expense"),
    getExistingBudgetKeys(supabase, bookId, periodMonth).catch(() => undefined),
  ]);

  return <BudgetForm bookId={bookId} homeHref={homeHref} categories={categories} existing={existing} periodMonth={periodMonth} />;
}
