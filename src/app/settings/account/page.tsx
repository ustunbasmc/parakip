import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AccountManagementView, type DeletionPreview } from "@/components/settings/AccountManagementView";

export default async function AccountManagementPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const [{ data: profile }, { data: preview }] = await Promise.all([
    supabase.from("profiles").select("deletion_requested_at").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("preview_account_deletion"),
  ]);

  return (
    <AccountManagementView
      deletionRequestedAt={profile?.deletion_requested_at ?? null}
      email={user.email ?? ""}
      preview={(preview as DeletionPreview | null) ?? null}
      graceDays={Number(process.env.ACCOUNT_DELETION_GRACE_DAYS ?? "7")}
    />
  );
}
