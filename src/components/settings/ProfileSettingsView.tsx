"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar, validateAvatarFile } from "@/lib/avatars";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { UserCircleIcon } from "@/components/icons";

/**
 * Profil bilgileri: görünen ad (profiles.display_name, kendi satırını
 * güncelleyen RLS ile), e-posta gösterimi + değişikliği (Supabase Auth'un
 * KENDİ güvenli doğrulama akışı — updateUser({email}) yeni adrese
 * onay bağlantısı gönderir, adres HEMEN değişmez), profil fotoğrafı
 * (private Storage bucket + imzalı URL, bkz. avatars.ts).
 */
export function ProfileSettingsView({
  displayName: initialDisplayName,
  avatarUrl: initialAvatarUrl,
  email: initialEmail,
  userId,
}: {
  displayName: string;
  avatarUrl: string | null;
  email: string;
  userId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosyayı tekrar seçebilmek için
    if (!file) return;

    setAvatarMessage(null);
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarMessage({ type: "error", text: validationError });
      return;
    }

    setUploadingAvatar(true);
    const supabase = createClient();
    const { path, error } = await uploadAvatar(supabase, userId, file);

    if (error || !path) {
      setUploadingAvatar(false);
      setAvatarMessage({ type: "error", text: error ?? "Fotoğraf yüklenemedi." });
      return;
    }

    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: path }).eq("user_id", userId);
    if (updateError) {
      setUploadingAvatar(false);
      setAvatarMessage({ type: "error", text: "Fotoğraf kaydedilemedi." });
      return;
    }

    // Yeni yüklenen dosya için anında yerel önizleme — sayfa yenilenince
    // sunucudan taze bir imzalı URL gelecek (bkz. page.tsx).
    setAvatarUrl(URL.createObjectURL(file));
    setUploadingAvatar(false);
    setAvatarMessage({ type: "success", text: "Profil fotoğrafı güncellendi." });
    router.refresh();
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMessage(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameMessage({ type: "error", text: "Görünen ad boş olamaz." });
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ display_name: trimmed }).eq("user_id", userId);
    setSavingName(false);
    if (error) {
      setNameMessage({ type: "error", text: "Kaydedilemedi. Lütfen tekrar dene." });
      return;
    }
    setNameMessage({ type: "success", text: "Görünen ad güncellendi." });
    router.refresh();
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailMessage({ type: "error", text: "Geçerli bir e-posta adresi gir." });
      return;
    }
    setSavingEmail(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSavingEmail(false);
    if (error) {
      setEmailMessage({ type: "error", text: error.message || "E-posta güncellenemedi." });
      return;
    }
    setEmailMessage({
      type: "success",
      text: `${trimmed} adresine bir onay bağlantısı gönderildi. Onaylayana kadar mevcut e-posta adresin geçerli kalır.`,
    });
    setNewEmail("");
  }

  return (
    <AppShell variant="subpage" title="Profil bilgilerim" backFallbackHref="/home">
      <div className="flex flex-col gap-5 pt-3 pb-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center">
          <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircleIcon size={36} />
            )}
          </span>

          {avatarMessage ? (
            avatarMessage.type === "error" ? (
              <p className="text-xs text-danger">{avatarMessage.text}</p>
            ) : (
              <p className="text-xs text-success">{avatarMessage.text}</p>
            )
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            loading={uploadingAvatar}
            fullWidth={false}
          >
            {avatarUrl ? "Fotoğrafı değiştir" : "Fotoğraf yükle"}
          </Button>
          <p className="text-xs text-text-muted">JPG, PNG veya WebP · en fazla 2 MB. Yalnızca sen görebilirsin.</p>
        </div>

        <form onSubmit={handleSaveName} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">Görünen ad</p>
          {nameMessage ? (
            nameMessage.type === "error" ? (
              <ErrorBanner message={nameMessage.text} />
            ) : (
              <p className="text-sm text-success">{nameMessage.text}</p>
            )
          ) : null}
          <TextField label="Ad soyad" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button type="submit" loading={savingName} fullWidth={false}>
            Kaydet
          </Button>
        </form>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">E-posta adresi</p>
          <p className="text-sm text-text-primary">{initialEmail}</p>

          <form onSubmit={handleChangeEmail} className="flex flex-col gap-3 border-t border-border pt-3">
            {emailMessage ? (
              emailMessage.type === "error" ? (
                <ErrorBanner message={emailMessage.text} />
              ) : (
                <p className="text-sm text-success">{emailMessage.text}</p>
              )
            ) : null}
            <TextField
              label="Yeni e-posta adresi"
              type="email"
              placeholder="yeni@eposta.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button type="submit" variant="secondary" loading={savingEmail} fullWidth={false}>
              E-postayı değiştir
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
