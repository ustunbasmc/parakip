"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/errors";
import { normalizeTurkishPhone } from "@/lib/format/phone";
import { ScreenShell } from "@/components/ScreenShell";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Ad ve soyad boş olamaz.");
      return;
    }

    const normalizedPhone = normalizeTurkishPhone(phone);
    if (!normalizedPhone) {
      setError("Geçerli bir cep telefonu numarası gir (ör. 0532 123 45 67).");
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Şifreler birbiriyle uyuşmuyor.");
      return;
    }
    if (!termsAccepted) {
      setError("Devam etmek için Kullanım Koşulları'nı ve Gizlilik Politikası'nı kabul etmelisin.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // NOT: telefon Supabase Auth'un KENDİ `phone` alanına DEĞİL, yalnızca
        // metadata'ya yazılır — bu, 0056'daki handle_new_user() trigger'ı
        // tarafından profiles tablosuna aktarılır. Auth'un phone alanını
        // kullanmak SMS doğrulamasını TETİKLERDİ, bu turda İSTENMİYOR.
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: normalizedPhone,
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      // E-posta onayı kapalıysa oturum hemen açılır.
      router.push("/onboarding/space-type");
      return;
    }

    setCheckEmail(true);
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setGoogleLoading(false);
      setError(translateAuthError(oauthError.message));
    }
    // Başarılıysa Supabase kullanıcıyı Google'a yönlendirir; bu sayfa
    // terk edilir, ek bir işlem gerekmez.
  }

  if (checkEmail) {
    return (
      <ScreenShell backFallbackHref="/welcome">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Logo withWordmark={false} />
          <h1 className="text-xl font-bold text-text-primary">E-postanı kontrol et</h1>
          <p className="max-w-xs text-text-secondary">
            <strong className="text-text-primary">{email}</strong> adresine bir onay bağlantısı
            gönderdik. Hesabını etkinleştirmek için bağlantıya tıkla.
          </p>
          <Link href="/sign-in" className="mt-2 text-sm font-semibold text-accent">
            Giriş ekranına dön
          </Link>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      backFallbackHref="/welcome"
      footer={
        <Button type="submit" form="sign-up-form" loading={loading}>
          Kayıt ol
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Hesap oluştur</h1>
          <p className="mt-1 text-text-secondary">
            Bilgilerini gir, hemen kullanmaya başla.
          </p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <form id="sign-up-form" onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                label="Ad"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextField
                label="Soyad"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
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
            label="Cep telefonu"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            placeholder="0532 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            hint="Telefon numaranız şu an doğrulama amacıyla kullanılmıyor — yalnızca profilinizde saklanır."
          />
          <TextField
            label="Şifre"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="En az 6 karakter"
          />
          <TextField
            label="Şifre (tekrar)"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />

          <label className="flex items-start gap-2.5 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-accent"
            />
            <span>
              <Link href="/legal/kullanim-kosullari" target="_blank" className="font-semibold text-accent">
                Kullanım Koşulları
              </Link>
              &apos;nı ve{" "}
              <Link href="/legal/gizlilik-politikasi" target="_blank" className="font-semibold text-accent">
                Gizlilik Politikası
              </Link>
              &apos;nı okudum, kabul ediyorum.
            </span>
          </label>
        </form>

        <div className="flex items-center gap-3 text-text-muted">
          <div className="h-px flex-1 bg-border" />
          <span className="text-sm">veya</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="secondary" onClick={handleGoogle} loading={googleLoading} type="button">
          <GoogleIcon />
          Google ile devam et
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Zaten hesabın var mı?{" "}
          <Link href="/sign-in" className="font-semibold text-accent">
            Giriş yap
          </Link>
        </p>
      </div>
    </ScreenShell>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.16.27-1.7V4.97H.9A9 9 0 000 9c0 1.45.35 2.83.9 4.04l3.05-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}
