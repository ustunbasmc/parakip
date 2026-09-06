import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewBusinessForm } from "@/components/spaces/NewBusinessForm";

export default async function NewBusinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) redirect("/welcome");

  const { data: spaces } = await supabase.from("spaces").select("type");
  const hasExistingBusiness = (spaces ?? []).some((s) => s.type === "business");

  return <NewBusinessForm hasExistingBusiness={hasExistingBusiness} />;
}
