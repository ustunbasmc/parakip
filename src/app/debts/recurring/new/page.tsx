import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecurringRuleForm } from "@/components/debts/RecurringRuleForm";

export default async function NewRecurringRulePage({
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
  const homeHref = space ? `/debts/recurring?space=${space}` : "/debts/recurring";

  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  return <RecurringRuleForm bookId={bookId} homeHref={homeHref} />;
}
