import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/Button";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";

/**
 * Oturumsuz karşılama ekranı. Mobilde tam ekran marka görseli + altta iki
 * buton (mevcut düzen); masaüstünde (lg+) solda marka paneli, sağda
 * kısa başlık ve aynı iki eylem — giriş/kayıt ekranlarıyla aynı kompozisyon.
 */
export default function WelcomePage() {
  return (
    <div className="min-h-dvh shrink-0 bg-bg lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthBrandPanel />

      <div className="flex min-h-dvh flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))] lg:items-center lg:justify-center lg:px-10 lg:py-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center lg:hidden">
          {/* Gerçek marka görseli — açık/koyu tema için AYRI dosyalar
              kullanılır; hangisinin gösterileceği globals.css'teki .dark
              kuralıyla belirlenir (hydration öncesi bile doğru varyant). */}
          <Image
            src="/brand/logo-light.png"
            alt="Parakip — Paran kontrolünde."
            width={480}
            height={320}
            priority
            className="theme-logo-light h-auto w-full max-w-[19rem]"
          />
          <Image
            src="/brand/logo-dark.png"
            alt="Parakip — Paran kontrolünde."
            width={480}
            height={320}
            priority
            className="theme-logo-dark h-auto w-full max-w-[19rem] rounded-3xl"
          />
        </div>

        <div className="w-full md:mx-auto md:max-w-[36rem] lg:max-w-[30rem] lg:rounded-3xl lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-[var(--shadow-elevated)]">
          <div className="mb-6 hidden lg:block">
            <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">Hoş geldin</h1>
            <p className="mt-2 text-text-secondary">Hesap oluştur ya da giriş yaparak kaldığın yerden devam et.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/sign-up">
              <Button variant="primary">Kayıt ol</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="secondary">Giriş yap</Button>
            </Link>
          </div>
          <p className="mt-6 hidden text-center text-xs text-text-muted lg:block">
            <Link href="/legal/kullanim-kosullari" className="font-semibold hover:text-accent">
              Kullanım Koşulları
            </Link>
            {" · "}
            <Link href="/legal/gizlilik-politikasi" className="font-semibold hover:text-accent">
              Gizlilik Politikası
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
