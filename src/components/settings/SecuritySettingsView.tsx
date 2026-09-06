"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/errors";
import { AppShell } from "@/components/AppShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * "Son oturum bilgileri için mevcut Supabase imkânlarını kullan; sahte
 * bilgi gösterme": Supabase'in istemci SDK'sı cihaz/konum bazlı bir
 * oturum LİSTESİ sunmuyor (bu bir Enterprise/admin API özelliğidir) —
 * bu yüzden burada YALNIZCA gerçekten var olan tek veri (user.
 * last_sign_in_at) gösterilir, sahte bir cihaz listesi UYDURULMAZ.
 */
export function SecuritySettingsView({ email, lastSignInAt }: { email: string; lastSignInAt: string | null }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [sendingReset, setSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const [signingOutAll, setSigningOutAll] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (password.length < 6) {
      setPasswordMessage({ type: "error", text: "Şifre en az 6 karakter olmalıdır." });
      return;
    }
    if (password !== confirm) {
      setPasswordMessage({ type: "error", text: "Şifreler birbiriyle uyuşmuyor." });
      return;
    }

    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordMessage({ type: "error", text: translateAuthError(error.message) });
      return;
    }
    setPasswordMessage({ type: "success", text: "Şifren güncellendi." });
    setPassword("");
    setConfirm("");
  }

  async function handleSendResetLink() {
    setResetMessage(null);
    setSendingReset(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setSendingReset(false);
    setResetMessage(error ? "Bağlantı gönderilemedi. Lütfen tekrar dene." : `${email} adresine bir şifre sıfırlama bağlantısı gönderildi.`);
  }

  async function handleSignOutCurrent() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/welcome");
    router.refresh();
  }

  async function handleSignOutAll() {
    setSignOutError(null);
    setSigningOutAll(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);
    if (error) {
      setSignOutError("İşlem gerçekleştirilemedi. Lütfen tekrar dene.");
      return;
    }
    router.push("/welcome");
    router.refresh();
  }

  return (
    <AppShell variant="subpage" title="Güvenlik" backFallbackHref="/home">
      <div className="flex flex-col gap-5 pt-3 pb-4">
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">Şifre değiştir</p>
          {passwordMessage ? (
            passwordMessage.type === "error" ? (
              <ErrorBanner message={passwordMessage.text} />
            ) : (
              <p className="text-sm text-success">{passwordMessage.text}</p>
            )
          ) : null}
          <TextField label="Yeni şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <TextField label="Yeni şifre (tekrar)" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" loading={savingPassword} fullWidth={false}>
            Şifreyi güncelle
          </Button>
        </form>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">Şifremi unuttum</p>
          <p className="text-xs text-text-muted">{email} adresine bir sıfırlama bağlantısı gönderebiliriz.</p>
          {resetMessage ? <p className="text-sm text-text-primary">{resetMessage}</p> : null}
          <Button variant="secondary" onClick={handleSendResetLink} loading={sendingReset} fullWidth={false}>
            Sıfırlama bağlantısı gönder
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">Son giriş</p>
          <p className="mt-1 text-sm text-text-primary">
            {lastSignInAt ? formatDate(lastSignInAt) : "Bilgi mevcut değil"}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-secondary">Oturumlar</p>
          {signOutError ? <ErrorBanner message={signOutError} /> : null}
          <Button variant="secondary" onClick={handleSignOutCurrent} fullWidth={false}>
            Bu oturumdan çıkış yap
          </Button>
          <Button variant="ghost" onClick={handleSignOutAll} loading={signingOutAll} fullWidth={false}>
            Tüm cihazlardan çıkış yap
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
