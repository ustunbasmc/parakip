import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { getInvitationPreview } from "@/lib/api/members-rpc";
import { InviteResponse } from "@/components/spaces/InviteResponse";

export const metadata = { title: "Davet | Parakip", robots: { index: false, follow: false } };

/**
 * Davet bağlantısı. Oturum yoksa middleware girişe yönlendirir ve
 * girişten sonra buraya geri döner (bkz. proxy.ts). Yalnızca davet edilen
 * e-postanın sahibi kabul edebilir; kontrol veritabanında yapılır.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);

  const preview = /^[a-f0-9]{64}$/.test(token) ? await getInvitationPreview(supabase, token).catch(() => null) : null;

  return (
    <AppShell variant="subpage" title="Alan daveti" parentHref="/home">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 pt-6 pb-8">
        <InviteResponse token={token} preview={preview} myEmail={user.email} />
      </div>
    </AppShell>
  );
}
