import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecuritySettingsView } from "@/components/settings/SecuritySettingsView";

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  if (!user) redirect("/welcome");

  return <SecuritySettingsView email={user.email ?? ""} lastSignInAt={user.last_sign_in_at ?? null} />;
}
