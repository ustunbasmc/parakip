"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/errors";
import { ScreenShell } from "@/components/ScreenShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler birbiriyle uyuşmuyor.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <ScreenShell
      backFallbackHref="/sign-in"
      footer={
        <Button type="submit" form="update-password-form" loading={loading}>
          Şifreyi güncelle
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Yeni şifre belirle</h1>
          <p className="mt-1 text-text-secondary">
            Hesabın için yeni bir şifre oluştur.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form id="update-password-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Yeni şifre"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="En az 6 karakter"
          />
          <TextField
            label="Yeni şifre (tekrar)"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </form>
      </div>
    </ScreenShell>
  );
}
