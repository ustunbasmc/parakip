"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/errors";
import { ScreenShell } from "@/components/ScreenShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Logo } from "@/components/Logo";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <ScreenShell backFallbackHref="/sign-in">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Logo withWordmark={false} />
          <h1 className="text-xl font-bold text-text-primary">Bağlantı gönderildi</h1>
          <p className="max-w-xs text-text-secondary">
            <strong className="text-text-primary">{email}</strong> adresine bir şifre sıfırlama
            bağlantısı gönderdik. Gelen kutunu kontrol et.
          </p>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      backFallbackHref="/sign-in"
      footer={
        <Button type="submit" form="reset-form" loading={loading}>
          Sıfırlama bağlantısı gönder
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Şifreni mi unuttun?</h1>
          <p className="mt-1 text-text-secondary">
            E-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form id="reset-form" onSubmit={handleSubmit}>
          <TextField
            label="E-posta"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </form>
      </div>
    </ScreenShell>
  );
}
