import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { GoalForm } from "@/components/goals/GoalForm";
import { getGoal } from "@/lib/dashboard/goals";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGoalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ space?: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const goal = await getGoal(supabase, id).catch(() => null);
  if (!goal) notFound();
  const { space } = await searchParams;

  return (
    <GoalForm
      bookId={goal.bookId}
      homeHref={`/goals/${goal.id}${space ? `?space=${space}` : ""}`}
      goal={{ id: goal.id, name: goal.name, targetCents: goal.targetCents, targetDate: goal.targetDate }}
    />
  );
}
