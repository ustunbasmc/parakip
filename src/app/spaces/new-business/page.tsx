import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { NewBusinessForm } from "@/components/spaces/NewBusinessForm";

export default async function NewBusinessPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) redirect("/welcome");

  const { data: spaces } = await supabase.from("spaces").select("type");
  const hasExistingBusiness = (spaces ?? []).some((s) => s.type === "business");

  return <NewBusinessForm hasExistingBusiness={hasExistingBusiness} />;
}
