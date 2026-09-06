import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountManagementView } from "@/components/settings/AccountManagementView";

export default async function AccountManagementPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("deletion_requested_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return <AccountManagementView deletionRequestedAt={profile?.deletion_requested_at ?? null} email={user.email ?? ""} />;
}
