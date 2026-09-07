"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReauthPasswordModal } from "@/components/settings/ReauthPasswordModal";
import { LockIcon } from "@/components/icons";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * "Hesap silme işlemi HEMEN veri kaybına yol açıyorsa bunu açıkça ifade
 * et ve güvenli bir talep/askıya alma akışı kullan": gerçek kullanıcı
 * silme işlemi service_role/admin API gerektirir (bu turun kapsamı
 * DIŞINDA) — bu yüzden buton yalnızca bir TALEP kaydeder
 * (profiles.deletion_requested_at), hiçbir veri HEMEN silinmez/kaybolmaz.
 * "E-posta onayı" için GERÇEKTE bir e-posta gönderen bir backend
 * KURULMADIĞINDAN, arayüz bunu DÜRÜSTÇE "ekibimiz e-posta ile seninle
 * iletişime geçecek" olarak ifade eder — sahte "onay e-postası
 * gönderildi" mesajı GÖSTERİLMEZ.
 */
export function AccountManagementView({
  deletionRequestedAt,
  email,
}: {
  deletionRequestedAt: string | null;
  email: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "reauth" | "confirm">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestDeletion() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("user_id", user?.id ?? "");
    setLoading(false);
    setStep("idle");
    if (updateError) {
      setError("Talep gönderilemedi. Lütfen tekrar dene.");
      return;
    }
    router.refresh();
  }

  async function handleCancelRequest() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: null })
      .eq("user_id", user?.id ?? "");
    setLoading(false);
    if (updateError) {
      setError("İşlem gerçekleştirilemedi.");
      return;
    }
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title="Hesap yönetimi" backFallbackHref="/home">
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3.5 text-xs text-text-muted">
          <LockIcon size={14} className="mt-0.5 shrink-0" />
          <p>
            Parakip&apos;te finansal kayıtlar (işlem, borç, alacak vb.) hiçbir zaman fiziksel olarak silinmez —
            hesap silme talebin onaylansa bile geçmiş kayıtların bütünlüğü korunur ve veriler HEMEN yok olmaz.
          </p>
        </div>

        {deletionRequestedAt ? (
          <div className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <p className="text-sm font-semibold text-warning">Hesap silme talebin alındı</p>
            <p className="mt-1 text-xs text-text-secondary">
              {formatDate(deletionRequestedAt)} tarihinde talep oluşturuldu. Ekibimiz, işleme almadan önce
              e-posta yoluyla seninle iletişime geçecek. Talebin işleme alınana kadar hesabın normal şekilde
              kullanılmaya devam edebilir.
            </p>
            <Button variant="secondary" onClick={handleCancelRequest} loading={loading} fullWidth={false} className="mt-3">
              Talebi iptal et
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text-primary">Önce verilerini indir</p>
              <p className="mt-1 text-xs text-text-muted">
                Hesabını silmeden önce işlem geçmişini ve borç/alacak kayıtlarını CSV olarak indirmeni öneririz.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/transactions" className="text-xs font-semibold text-accent">
                  İşlem geçmişini indir →
                </Link>
                <Link href="/debts" className="text-xs font-semibold text-accent">
                  Borç/alacakları indir →
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text-primary">Hesabımı sil</p>
              <p className="mt-1 text-xs text-text-muted">
                Bu, hesabını HEMEN silmez — şifre doğrulaması istenir ve bir silme TALEBİ oluşturulur. En az 7
                gün boyunca talebi buradan iptal edebilirsin. Süre sonunda kişisel bilgilerin (ad, telefon,
                e-posta) kalıcı olarak temizlenir; finansal geçmişin ise ASLA silinmez, arşivlenmiş olarak kalır.
              </p>
              <Button variant="ghost" onClick={() => setStep("reauth")} fullWidth={false} className="mt-3 !text-danger">
                Hesap silme talebi oluştur
              </Button>
            </div>
          </>
        )}
      </div>

      <ReauthPasswordModal
        open={step === "reauth"}
        email={email}
        title="Hesap silme talebi oluştur"
        onSuccess={() => setStep("confirm")}
        onCancel={() => setStep("idle")}
      />

      <ConfirmModal
        open={step === "confirm"}
        title="Hesap silme talebi oluştur"
        description="Bu işlem hesabını hemen silmez, ancak silme sürecini başlatan bir talep oluşturur ve ekibimiz e-posta ile seninle iletişime geçer. Devam etmek istediğine emin misin?"
        confirmLabel="Talep oluştur"
        danger
        loading={loading}
        onConfirm={handleRequestDeletion}
        onCancel={() => setStep("idle")}
      />
    </AppShell>
  );
}
