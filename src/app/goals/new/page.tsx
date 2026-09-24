import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { GoalForm } from "@/components/goals/GoalForm";

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ book_id?: string; space?: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { book_id: bookId, space } = await searchParams;
  const homeHref = space ? `/goals?space=${space}` : "/goals";
  if (!bookId) redirect(homeHref);

  const { data: book } = await supabase.from("books").select("id").eq("id", bookId).maybeSingle();
  if (!book) redirect(homeHref);

  return <GoalForm bookId={bookId} homeHref={homeHref} />;
}
