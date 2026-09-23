"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/errors";
import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ResendConfirmation } from "@/components/auth/ResendConfirmation";
import { safeNext } from "@/lib/auth/safeNext";

// useSearchParams (?next=) statik ön-render'da Suspense sınırı gerektirir.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInPageInner />
    </Suspense>
  );
}

function SignInPageInner() {
  const router = useRouter();
  // Davet bağlantısı gibi bir sayfadan girişe gelindiyse, girişten sonra oraya dönülür.
  const next = safeNext(useSearchParams().get("next"));
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
      setUnconfirmed(signInError.message.toLowerCase().includes("email not confirmed"));
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}` },
    });
    if (oauthError) {
      setGoogleLoading(false);
      setError(translateAuthError(oauthError.message));
    }
  }

  return (
    <AuthShell
      parentHref="/welcome"
      footer={
        <Button type="submit" form="sign-in-form" loading={loading}>
          Giriş yap
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Tekrar hoş geldin</h1>
          <p className="mt-1 text-text-secondary">Hesabına giriş yap.</p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}
        {unconfirmed ? <ResendConfirmation email={email.trim()} next={next !== "/" ? next : undefined} /> : null}

        <form id="sign-in-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="E-posta"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Şifre"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link href="/reset-password" className="self-end text-sm font-semibold text-accent">
            Şifremi unuttum
          </Link>
        </form>

        <div className="flex items-center gap-3 text-text-muted">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm">veya</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" onClick={handleGoogle} loading={googleLoading} type="button">
          Google ile devam et
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Hesabın yok mu?{" "}
          <Link href={next !== "/" ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"} className="font-semibold text-accent">
            Kayıt ol
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
