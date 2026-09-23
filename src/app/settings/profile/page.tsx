import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ProfileSettingsView } from "@/components/settings/ProfileSettingsView";
import { getSignedAvatarUrl } from "@/lib/avatars";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/welcome");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const signedAvatarUrl = await getSignedAvatarUrl(supabase, profile?.avatar_url ?? null);

  return (
    <ProfileSettingsView
      displayName={profile?.display_name ?? ""}
      avatarUrl={signedAvatarUrl}
      email={user.email ?? ""}
      userId={user.id}
    />
  );
}
