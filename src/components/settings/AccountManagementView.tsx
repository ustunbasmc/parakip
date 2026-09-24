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

export interface DeletionPreview {
  deleted: { id: string; name: string; type: "home" | "business" }[];
  transferred: { id: string; name: string; type: "home" | "business"; to: string }[];
  left: number;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/**
 * Hesap silme: buton yalnızca bir TALEP kaydeder (profiles.deletion_requested_at);
 * hiçbir şey hemen silinmez. Bekleme süresi dolunca günlük görev
 * (/api/admin/complete-account-deletions) hesabı ve kullanıcının tek
 * başına kullandığı alanları KALICI olarak siler; ortak alanlarda sahiplik
 * devredilir (bkz. migration 0069). Ne olacağı talepten önce
 * preview_account_deletion() ile açıkça gösterilir. E-posta gönderilmez.
 */
export function AccountManagementView({
  deletionRequestedAt,
  email,
  preview,
  graceDays,
}: {
  deletionRequestedAt: string | null;
  email: string;
  preview: DeletionPreview | null;
  graceDays: number;
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
    <AppShell variant="subpage" title="Hesap yönetimi" helpSlug="hesabimi-nasil-silebilirim">
      <div className="flex flex-col gap-5 pt-3 pb-4">
        {error ? <ErrorBanner message={error} /> : null}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Verilerimi indir</p>
          <p className="mt-1 text-xs text-text-muted">
            Profilin, alanların, hesapların, tüm gelir-gider kayıtların, borçların, bütçe ve hedeflerin tek bir dosyada
            (JSON) iner. Excel için Hareketler ve Borçlar ekranlarındaki CSV indirmeyi kullanabilirsin.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href="/api/account/export"
              download
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-bold text-text-on-accent"
            >
              <LockIcon size={13} />
              Tüm verilerimi indir
            </a>
            <Link href="/transactions" className="text-xs font-semibold text-accent">
              Hareketler (CSV) →
            </Link>
            <Link href="/debts" className="text-xs font-semibold text-accent">
              Borç/alacaklar (CSV) →
            </Link>
          </div>
        </div>

        {deletionRequestedAt ? (
          <div className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
            <p className="text-sm font-semibold text-warning">Hesap silme talebin alındı</p>
            <p className="mt-1 text-xs text-text-secondary">
              {formatDate(deletionRequestedAt)} tarihinde talep oluşturuldu. Hesabın ve aşağıda belirtilen veriler{" "}
              <strong>{formatDate(new Date(new Date(deletionRequestedAt).getTime() + graceDays * 86_400_000).toISOString())}</strong>{" "}
              tarihinden sonra kalıcı olarak silinecek. O zamana kadar hesabını normal şekilde kullanabilir ve talebi iptal
              edebilirsin.
            </p>
            <DeletionImpact preview={preview} />
            <Button variant="secondary" onClick={handleCancelRequest} loading={loading} fullWidth={false} className="mt-3">
              Talebi iptal et
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-text-primary">Hesabımı sil</p>
            <p className="mt-1 text-xs text-text-muted">
              Hiçbir şey hemen silinmez: şifreni doğrulayıp bir silme talebi oluşturursun ve {graceDays} gün boyunca
              buradan iptal edebilirsin. Süre dolunca hesabın ve verilerin <strong>kalıcı olarak</strong> silinir, geri
              alınamaz. Önce yukarıdan verilerini indirmeni öneririz.
            </p>
            <DeletionImpact preview={preview} />
            <Button variant="ghost" onClick={() => setStep("reauth")} fullWidth={false} className="mt-3 !text-danger">
              Hesap silme talebi oluştur
            </Button>
          </div>
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
        description={`Bu işlem hesabını hemen silmez; ${graceDays} günlük bekleme süresi olan bir silme talebi oluşturur. Süre dolunca hesabın ve tek başına kullandığın alanlar kalıcı olarak silinir. Bu sürede talebi iptal edebilirsin. Devam etmek istediğine emin misin?`}
        confirmLabel="Talep oluştur"
        danger
        loading={loading}
        onConfirm={handleRequestDeletion}
        onCancel={() => setStep("idle")}
      />
    </AppShell>
  );
}

const TYPE_LABEL = { home: "Ev", business: "İşletme" } as const;

/** Silme tamamlandığında hangi alanlara ne olacağı (gerçek verilerden). */
function DeletionImpact({ preview }: { preview: DeletionPreview | null }) {
  if (!preview) return null;
  const { deleted, transferred, left } = preview;
  if (deleted.length === 0 && transferred.length === 0 && left === 0) return null;
  return (
    <ul className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-muted p-3 text-xs text-text-secondary">
      {deleted.length > 0 ? (
        <li>
          <span className="font-semibold text-danger">Kalıcı olarak silinecek:</span>{" "}
          {deleted.map((s) => (s.name === TYPE_LABEL[s.type] ? s.name : `${s.name} (${TYPE_LABEL[s.type]})`)).join(", ")} — tüm hesapları ve kayıtlarıyla.
        </li>
      ) : null}
      {transferred.map((s) => (
        <li key={s.id}>
          <span className="font-semibold text-text-primary">{s.name}</span> ortak bir alan; silinmeyecek, sahipliği{" "}
          <span className="font-semibold text-text-primary">{s.to}</span> kişisine devredilecek.
        </li>
      ))}
      {left > 0 ? <li>Üyesi olduğun {left} ortak alandan çıkarılacaksın; o alanların kayıtları silinmez.</li> : null}
    </ul>
  );
}
