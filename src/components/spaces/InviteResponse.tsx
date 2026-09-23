"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyMemberError, respondToInvitation, ROLE_DESCRIPTIONS, ROLE_LABELS, type InvitationPreview } from "@/lib/api/members-rpc";
import { clearOfflineSnapshots } from "@/lib/offline/snapshotStore";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { BuildingIcon, WalletIcon } from "@/components/icons";

function Message({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
      <p className="text-lg font-bold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">{text}</p>
      {action}
    </div>
  );
}

export function InviteResponse({ token, preview, myEmail }: { token: string; preview: InvitationPreview | null; myEmail: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const home = (
    <Link href="/home" className="text-sm font-semibold text-accent">
      Ana sayfaya git
    </Link>
  );

  if (!preview) return <Message title="Davet bulunamadı" text="Bağlantı hatalı ya da davet silinmiş olabilir. Davet edene yeni bağlantı göndermesini söyleyebilirsin." action={home} />;
  if (declined) return <Message title="Davet reddedildi" text={`"${preview.spaceName}" alanına katılmadın.`} action={home} />;
  if (preview.alreadyMember) {
    return <Message title="Zaten üyesin" text={`"${preview.spaceName}" alanının zaten üyesisin.`} action={home} />;
  }
  if (preview.status !== "pending") {
    const text =
      preview.status === "accepted"
        ? "Bu davet daha önce kabul edilmiş."
        : preview.status === "declined"
          ? "Bu davet reddedilmiş."
          : "Bu davet geri çekilmiş. Yeni bir davet isteyebilirsin.";
    return <Message title="Davet artık geçerli değil" text={text} action={home} />;
  }
  if (preview.expired) {
    return <Message title="Davetin süresi dolmuş" text="Davetler 7 gün geçerlidir. Davet edenden yeni bir davet göndermesini iste." action={home} />;
  }
  if (!preview.emailMatches) {
    return (
      <Message
        title="Bu davet başka bir hesaba"
        text={`Davet ${preview.emailHint} adresine gönderildi; sen ${myEmail ?? "başka bir hesapla"} giriş yaptın. Daveti kabul etmek için o e-posta adresiyle giriş yapman gerekiyor.`}
        action={home}
      />
    );
  }

  async function respond(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      const supabase = createClient();
      const { data: spaceId, error: rpcError } = await respondToInvitation(supabase, token, accept);
      if (rpcError) {
        setError(friendlyMemberError(rpcError));
        return;
      }
      if (!accept) {
        setDeclined(true);
        return;
      }
      // Yeni alan: bir sonraki çevrimdışı kopyada yer alsın diye eski kopya bırakılmaz.
      await clearOfflineSnapshots();
      router.push(`/home?space=${spaceId}`);
      router.refresh();
    } catch {
      setError("İşlem gerçekleştirilemedi. Lütfen tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  const Icon = preview.spaceType === "business" ? BuildingIcon : WalletIcon;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon size={22} />
        </span>
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{preview.inviterName}</strong> seni davet etti
        </p>
        <p className="text-xl font-extrabold text-text-primary">{preview.spaceName}</p>
        <p className="text-xs text-text-muted">{preview.spaceType === "business" ? "İşletme alanı" : "Ev alanı"}</p>
        <div className="w-full rounded-xl bg-surface-muted p-3 text-left">
          <p className="text-sm font-semibold text-text-primary">Rolün: {ROLE_LABELS[preview.role]}</p>
          <p className="mt-0.5 text-xs text-text-muted">{ROLE_DESCRIPTIONS[preview.role]}</p>
        </div>
        <p className="text-xs text-text-muted">
          Kabul edersen bu alanın hesaplarını ve kayıtlarını görebilirsin. Kendi alanların ayrı kalır; alan sahibi senin
          alanlarını göremez.
        </p>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      <Button onClick={() => respond(true)} loading={busy === "accept"} disabled={busy !== null}>
        Daveti kabul et
      </Button>
      <Button variant="ghost" onClick={() => respond(false)} loading={busy === "decline"} disabled={busy !== null}>
        Reddet
      </Button>
    </div>
  );
}
